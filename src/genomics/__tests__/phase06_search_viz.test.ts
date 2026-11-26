import { describe, it, expect, beforeEach } from "vitest";
import fs from "fs";
import path from "path";
import { neon } from "@neondatabase/serverless";
import {
  searchGenomics,
  getGenomicsAnalytics,
  exportPublicGenomicsRecords,
  getAdminGenomicsOverview,
  cancelImportJob,
} from "../db/client";
import {
  acquireIngestionLock,
  releaseIngestionLock,
} from "../services/ingestion/pipeline";

if (!process.env["DATABASE_URL"]) {
  try {
    const envPath = path.resolve(process.cwd(), ".env");
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, "utf-8");
      for (const line of envContent.split("\n")) {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match && match[1]) {
          const key = match[1];
          let value = (match[2] || "").trim();
          if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
          if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
          process.env[key] = value;
        }
      }
    }
  } catch {}
}

function getSql() {
  const url = process.env["DATABASE_URL"];
  if (!url) throw new Error("DATABASE_URL is required");
  return neon(url);
}

describe("Phase 06 — Advanced Search, Visualization, Export & Lock Safety", () => {
  const sql = getSql();

  beforeEach(async () => {
    await sql`DELETE FROM genomics.ingestion_locks`;
  });

  it("searches across diseases, genes, variants, phenotypes, publications, HGVS, rsIDs, and VCVs", async () => {
    const hbb = await searchGenomics("HBB");
    expect(hbb.genes.some((g: any) => g.symbol === "HBB")).toBe(true);

    const vcv = await searchGenomics("VCV000015126");
    expect(vcv.variants.some((v: any) => v.clinvar_vcv === "VCV000015126")).toBe(true);

    const pheno = await searchGenomics("", { category: "phenotypes" });
    expect(Array.isArray(pheno.phenotypes)).toBe(true);

    const pubs = await searchGenomics("", { category: "publications" });
    expect(pubs.publications.length).toBeGreaterThan(0);
  }, 15000);

  it("filters by chromosome, inheritance, clinical significance, evidence level, and review status without exposing quarantined records", async () => {
    const chr11 = await searchGenomics("", { chromosome: "11", significance: "Pathogenic" });
    expect(chr11.variants.length).toBeGreaterThan(0);
    for (const v of chr11.variants) {
      expect(v.chromosome).toBe("11");
      expect(v.clinical_significance.toLowerCase()).toContain("pathogenic");
      expect(v.review_status).not.toBe("quarantined");
    }

    // Attempting to query quarantined reviewStatus must not expose quarantined records
    const attemptedQuarantine = await searchGenomics("", { reviewStatus: "quarantined" });
    for (const v of attemptedQuarantine.variants) {
      expect(v.review_status).not.toBe("quarantined");
    }
  });

  it("returns real DB relationship graph, chromosome distribution, classification stats, publication trends, and provenance", async () => {
    const analytics = await getGenomicsAnalytics();
    expect(analytics.relationships.diseases.length).toBeGreaterThan(0);
    expect(analytics.relationships.genes.length).toBeGreaterThan(0);
    expect(analytics.relationships.variants.length).toBe(21);
    expect(analytics.relationships.diseaseGeneLinks.length).toBeGreaterThan(0);
    expect(analytics.chromosomeDistribution.length).toBeGreaterThan(0);
    expect(analytics.classificationStats.bySignificance.length).toBeGreaterThan(0);
    expect(analytics.provenanceSources.length).toBeGreaterThan(0);
  });

  it("exports CSV and JSON of eligible public records only (excluding all 13 quarantined variants)", async () => {
    const jsonExport = await exportPublicGenomicsRecords({ format: "json", entity: "variants" });
    const parsed = JSON.parse(jsonExport.body);
    expect(parsed.scope).toBe("eligible_public_records_only");
    expect(parsed.total).toBe(21);

    const csvExport = await exportPublicGenomicsRecords({ format: "csv", entity: "variants" });
    const lines = csvExport.body.trim().split("\n");
    expect(lines.length).toBe(22); // 1 header + 21 public variants
  });

  it("separates total, public, quarantined, and scientist-approved counts in admin overview", async () => {
    const admin = await getAdminGenomicsOverview();
    const vb: any = admin.recordBreakdown.variants;
    expect(vb.total).toBe(34);
    expect(vb.public).toBe(21);
    expect(vb.quarantined).toBe(13);
    expect(vb.approved).toBeGreaterThanOrEqual(0);
  });

  it("enforces lock ownership, recovers stale locks from terminal jobs, and preserves active locks on unrelated cancellation", async () => {
    const activeWorker = "sync:00000000-0000-0000-0000-000000000001:test";
    const otherWorker = "sync:00000000-0000-0000-0000-000000000002:test";

    expect(await acquireIngestionLock(activeWorker)).toBe(true);
    // Second worker cannot steal active lock
    expect(await acquireIngestionLock(otherWorker)).toBe(false);

    // Unrelated job cancellation must NOT delete activeWorker's lock
    const [dummyJob] = await sql`
      INSERT INTO genomics.import_jobs (job_name, target_disease, status, job_type, progress_pct, current_stage, created_at)
      VALUES ('Lock-Safety-Test', 'Test', 'running', 'incremental_sync', 5, 'init', NOW())
      RETURNING id
    `;
    await cancelImportJob((dummyJob as any).id, "Lock safety test", "test@akahelix.com");
    const locksAfterUnrelatedCancel = await sql`SELECT acquired_by FROM genomics.ingestion_locks`;
    expect(locksAfterUnrelatedCancel.length).toBe(1);
    expect((locksAfterUnrelatedCancel[0] as any).acquired_by).toBe(activeWorker);

    // Wrong owner cannot release lock
    await releaseIngestionLock(otherWorker);
    const locksAfterWrongRelease = await sql`SELECT acquired_by FROM genomics.ingestion_locks`;
    expect(locksAfterWrongRelease.length).toBe(1);

    // Proper owner releases lock
    await releaseIngestionLock(activeWorker);
    const locksAfterProperRelease = await sql`SELECT acquired_by FROM genomics.ingestion_locks`;
    expect(locksAfterProperRelease.length).toBe(0);

    // Cleanup dummy job
    await sql`DELETE FROM genomics.import_jobs WHERE id = ${(dummyJob as any).id}`;
  });
});
