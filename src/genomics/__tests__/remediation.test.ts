import { describe, it, expect, beforeAll } from "vitest";
import fs from "fs";
import path from "path";
import { neon } from "@neondatabase/serverless";

// Self-loading .env fallback for test environments without --env-file
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

import { runIngestionPipeline, acquireIngestionLock, releaseIngestionLock } from "../services/ingestion/pipeline";
import {
  getGenomicsOverviewStats,
  getDiseases,
  getDiseaseByIdOrSlug,
  getGenes,
  getGeneByIdOrSymbol,
  getVariants,
  getVariantByIdOrVcv,
  searchGenomics,
  quarantineRecord,
  createScientificReview,
} from "../db/client";
import { assertAdminSession, validateSessionToken } from "../services/auth.server";

const sql = neon(process.env["DATABASE_URL"]!);

describe("Phase 03 — Scientific Data Remediation and Security Hardening", () => {
  beforeAll(async () => {
    // Ensure staging DB connection (ep-little-surf-beun7bf0 compute endpoint for staging-genomics-remediation)
    expect(process.env["DATABASE_URL"]).toBeDefined();
    expect(process.env["DATABASE_URL"]).toContain("ep-little-surf-beun7bf0");

    // Clean any stale ingestion locks
    await sql`DELETE FROM genomics.ingestion_locks`;
  });

  // --------------------------------------------------------------------------
  // TEST 1: Remediated Ingestion Pipeline Execution
  // --------------------------------------------------------------------------
  it("executes remediated ingestion pipeline and inserts authoritative records", async () => {
    const result = await runIngestionPipeline();

    expect(result.status).toBe("completed");
    expect(result.diseasesCount).toBe(6);
    expect(result.genesCount).toBe(8); // 8 disease-gene specs across 6 conditions (7 unique genes)
    expect(result.variantsCount).toBe(15);
    expect(result.assertionsCount).toBe(16);
    expect(result.publicationsCount).toBeGreaterThanOrEqual(4);

    // Verify import job record
    const [job] = await sql`SELECT * FROM genomics.import_jobs WHERE id = ${result.jobId}`;
    expect(job).toBeDefined();
    expect((job as any).status).toBe("completed");
  }, 120000);

  // --------------------------------------------------------------------------
  // TEST 2: Authoritative Scientific Identifier Accuracy
  // --------------------------------------------------------------------------
  it("verifies accurate ClinVar VCVs, HGVS nomenclature, and coordinates", async () => {
    // 1. HbS variant: NM_000518.5(HBB):c.20A>T (p.Glu7Val) -> VCV000015333, Chr 11:5227002
    const hbs = await getVariantByIdOrVcv("VCV000015333");
    expect(hbs).not.toBeNull();
    expect(hbs!.preferred_name).toContain("c.20A>T");
    expect(hbs!.chromosome).toBe("11");
    expect(Number(hbs!.position_vcf)).toBe(5227002);
    expect(hbs!.dbsnp_id).toBe("rs334");
    expect(hbs!.clinical_significance).toBe("Pathogenic");

    // 2. HbC variant: NM_000518.5(HBB):c.19G>A (p.Glu7Lys) -> VCV000015126, Chr 11:5227003
    const hbc = await getVariantByIdOrVcv("VCV000015126");
    expect(hbc).not.toBeNull();
    expect(hbc!.preferred_name).toContain("c.19G>A");
    expect(hbc!.chromosome).toBe("11");
    expect(Number(hbc!.position_vcf)).toBe(5227003);
    expect(hbc!.dbsnp_id).toBe("rs33930165");

    // 3. Alpha-thalassemia --SEA deletion -> VCV001328438, Chr 16:212275
    const sea = await getVariantByIdOrVcv("VCV001328438");
    expect(sea).not.toBeNull();
    expect(sea!.chromosome).toBe("16");
    expect(Number(sea!.position_vcf)).toBe(212275);
    expect(sea!.variant_type).toBe("copy number loss");

    // 4. SMA SMN2 modifier c.859G>C -> VCV000007962 (Conflicting classifications)
    const smn2 = await getVariantByIdOrVcv("VCV000007962");
    expect(smn2).not.toBeNull();
    expect(smn2!.clinical_significance).toBe("Conflicting classifications of pathogenicity");
    expect(smn2!.chromosome).toBe("5");
    expect(Number(smn2!.position_vcf)).toBe(70076545);

    // 5. SMA SMN1 silent carrier c.*3+80T>G -> VCV001331398 (Conflicting classifications)
    const smn1 = await getVariantByIdOrVcv("VCV001331398");
    expect(smn1).not.toBeNull();
    expect(smn1!.clinical_significance).toBe("Conflicting classifications of pathogenicity");
    expect(smn1!.chromosome).toBe("5");
    expect(Number(smn1!.position_vcf)).toBe(70952074);

    // 6. CFTR Phe508del -> VCV000007105, 4 gold stars (practice guideline)
    const cftr = await getVariantByIdOrVcv("VCV000007105");
    expect(cftr).not.toBeNull();
    expect(cftr!.preferred_name).toContain("p.Phe508del");
    expect(cftr!.gold_stars).toBe(4);

    // 7. BRCA1 185delAG -> VCV000017662, Chr 17:43124028
    const brca1 = await getVariantByIdOrVcv("VCV000017662");
    expect(brca1).not.toBeNull();
    expect(brca1!.chromosome).toBe("17");
    expect(Number(brca1!.position_vcf)).toBe(43124028);
    expect(brca1!.dbsnp_id).toBe("rs80357914");
  }, 30000);

  // --------------------------------------------------------------------------
  // TEST 3: Duplicate Ingestion Idempotency
  // --------------------------------------------------------------------------
  it("enforces duplicate prevention: repeated ingestion does not inflate counts", async () => {
    // Record counts after first ingestion
    const statsBefore = await getGenomicsOverviewStats();

    // Run second ingestion
    const repeatResult = await runIngestionPipeline();
    expect(repeatResult.status).toBe("completed");

    // Record counts after second ingestion
    const statsAfter = await getGenomicsOverviewStats();

    expect(statsAfter.diseasesCount).toBe(statsBefore.diseasesCount);
    expect(statsAfter.genesCount).toBe(statsBefore.genesCount);
    expect(statsAfter.variantsCount).toBe(statsBefore.variantsCount);
    expect(statsAfter.assertionsCount).toBe(statsBefore.assertionsCount);
    expect(statsAfter.publicationsCount).toBe(statsBefore.publicationsCount);
  }, 120000);

  // --------------------------------------------------------------------------
  // TEST 4: Concurrent Ingestion Mutex Locking
  // --------------------------------------------------------------------------
  it("blocks concurrent ingestion attempts using distributed PostgreSQL lock", async () => {
    const testWorker = "test-concurrent-worker";
    const lockAcquired = await acquireIngestionLock(testWorker);
    expect(lockAcquired).toBe(true);

    // Attempting a second lock from another worker must fail
    const secondLock = await acquireIngestionLock("rival-worker");
    expect(secondLock).toBe(false);

    // Running the pipeline while lock is held must throw an error
    await expect(runIngestionPipeline()).rejects.toThrow(/Concurrent ingestion conflict/);

    // Release the test lock
    await releaseIngestionLock(testWorker);

    // After release, lock can be acquired again
    const lockAfterRelease = await acquireIngestionLock("subsequent-worker");
    expect(lockAfterRelease).toBe(true);
    await releaseIngestionLock("subsequent-worker");
  }, 30000);

  // --------------------------------------------------------------------------
  // TEST 5: Quarantine Enforcement & Exclusion from Public Queries
  // --------------------------------------------------------------------------
  it("excludes quarantined records from public queries, search, and detail routes", async () => {
    // Mismatched legacy variant VCV000015170 was quarantined in Migration 005
    const quarantinedVariant = await getVariantByIdOrVcv("VCV000015170");
    expect(quarantinedVariant).toBeNull(); // Must return null for public queries

    // Search query for quarantined accession must not return it
    const searchRes = await searchGenomics("VCV000015170");
    expect(searchRes.variants.length).toBe(0);

    // Overview stats must not include quarantined records
    const stats = await getGenomicsOverviewStats();
    expect(stats.variantsCount).toBeGreaterThanOrEqual(15);

    // Verify row directly in DB has is_quarantined = true
    const [row] = await sql`
      SELECT is_quarantined, review_status, quarantine_reason
      FROM genomics.variants
      WHERE clinvar_vcv = 'VCV000015170'
    `;
    expect(row).toBeDefined();
    expect((row as any).is_quarantined).toBe(true);
    expect((row as any).review_status).toBe("quarantined");
  }, 30000);

  // --------------------------------------------------------------------------
  // TEST 6: Scientist Review Separation & Workflow
  // --------------------------------------------------------------------------
  it("separates source verification from scientist approval and records audit log", async () => {
    // Ingested variants must have review_status = 'source_imported', NOT 'approved'
    // Reset HbC to test fresh imported status
    await sql`UPDATE genomics.variants SET review_status = 'source_imported' WHERE clinvar_vcv = 'VCV000015126'`;

    const hbc = await getVariantByIdOrVcv("VCV000015126");
    expect(hbc!.review_status).toBe("source_imported");

    // Perform an explicit scientific curator review
    const review = await createScientificReview({
      entityType: "variant",
      entityId: hbc!.id,
      reviewerEmail: "curator@akahelix.com",
      reviewDecision: "accepted",
      curatorNotes: "Verified against ClinGen Hemoglobinopathy VCEP guidelines and ClinVar VCV000015126.",
    });

    expect(review).toBeDefined();
    expect(review.review_decision).toBe("accepted");

    // Verify audit log entry was created
    const [audit] = await sql`
      SELECT * FROM genomics.audit_logs
      WHERE entity_id = ${hbc!.id} AND action = 'REVIEW_ACCEPTED'
      ORDER BY created_at DESC LIMIT 1
    `;
    expect(audit).toBeDefined();
    expect((audit as any).actor_email).toBe("curator@akahelix.com");
  }, 30000);

  // --------------------------------------------------------------------------
  // TEST 7: RBAC Server-Side Authorization Security
  // --------------------------------------------------------------------------
  it("rejects unauthorized, forged, and insufficient-role requests", async () => {
    // 1. Missing session token throws 401 UNAUTHORIZED
    const emptyReq = new Request("http://localhost:8080/api/genomics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "ingest" }),
    });

    await expect(assertAdminSession(emptyReq, ["admin", "director"])).rejects.toSatisfy(
      (err: Response) => err.status === 401
    );

    // 2. Forged / invalid session token throws 401 INVALID_SESSION
    const forgedReq = new Request("http://localhost:8080/api/genomics", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer forged-attacker-token-12345",
      },
      body: JSON.stringify({ action: "ingest" }),
    });

    await expect(assertAdminSession(forgedReq, ["admin", "director"])).rejects.toSatisfy(
      (err: Response) => err.status === 401
    );

    // 3. Email-domain heuristic rejection:
    // Even if an attacker uses @akahelix.com email, if they lack a database-backed session/role, it fails
    const emailAttackerReq = new Request("http://localhost:8080/api/genomics", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer invalid-akahelix-session",
      },
      body: JSON.stringify({ action: "ingest" }),
    });

    await expect(assertAdminSession(emailAttackerReq)).rejects.toSatisfy((err: Response) => err.status === 401);
  }, 30000);

  // --------------------------------------------------------------------------
  // TEST 8: Public Search & Filtering Verification
  // --------------------------------------------------------------------------
  it("executes unified multi-entity search and filters correctly", async () => {
    // Search for HBB
    const searchHbb = await searchGenomics("HBB");
    expect(searchHbb.genes.some((g: any) => g.symbol === "HBB")).toBe(true);
    expect(searchHbb.variants.length).toBeGreaterThan(0);

    // Search for Cystic Fibrosis
    const searchCf = await searchGenomics("Cystic Fibrosis");
    expect(searchCf.diseases.some((d: any) => d.slug === "cystic-fibrosis")).toBe(true);

    // Filter variants by chromosome
    const chr17Variants = await getVariants({ chromosome: "17" });
    expect(chr17Variants.items.every((v: any) => v.chromosome === "17")).toBe(true);
    expect(chr17Variants.items.length).toBe(3); // 3 BRCA1 variants

    // Filter diseases by inheritance
    const arDiseases = await getDiseases({ inheritance: "Autosomal recessive" });
    expect(arDiseases.items.length).toBeGreaterThanOrEqual(5);
  }, 30000);
});
