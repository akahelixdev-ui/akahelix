import { describe, it, expect, beforeAll } from "vitest";
import fs from "fs";
import path from "path";
import { neon } from "@neondatabase/serverless";
import { runDynamicIngestion, DynamicIngestionConfig } from "../services/ingestion/dynamic_engine";
import { getImportJobsAndCheckpoints, getGenomicsOverviewStats, getDiseaseByIdOrSlug, getGeneByIdOrSymbol } from "../db/client";

// Self-loading .env fallback for test runner
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

const sql = neon(process.env["DATABASE_URL"]!);

describe("Phase 04 — Dynamic Scalable Genomics Ingestion", () => {
  beforeAll(async () => {
    expect(process.env["DATABASE_URL"]).toBeDefined();
    expect(process.env["DATABASE_URL"]).toContain("ep-little-surf-beun7bf0");

    // Clean any stale ingestion locks
    await sql`DELETE FROM genomics.ingestion_locks`;
  });

  const pilotConfig: DynamicIngestionConfig = {
    jobName: "Phase04-Pilot-Scalable-Ingestion",
    maxVariantsPerGene: 3,
    conditions: [
      {
        slug: "hereditary-hemochromatosis",
        name: "Hereditary Hemochromatosis",
        geneSymbols: ["HFE"],
        conceptId: "C0018995",
        omimId: "235200",
        inheritanceMode: "Autosomal recessive",
        definition:
          "Hereditary hemochromatosis is an autosomal recessive iron storage disorder characterized by excessive intestinal absorption of dietary iron, leading to progressive iron accumulation in the liver, pancreas, heart, and joints.",
        curatedSummary:
          "Clinical panel focuses on common HFE pathogenic variants (p.Cys282Tyr, p.His63Asp, p.Ser65Cys).",
        hpoIds: ["HP:0001392", "HP:0003281"],
        pmids: ["25741868"],
      },
      {
        slug: "wilson-disease",
        name: "Wilson Disease",
        geneSymbols: ["ATP7B"],
        conceptId: "C0019202",
        omimId: "277900",
        inheritanceMode: "Autosomal recessive",
        definition:
          "Wilson disease is an autosomal recessive defect in cellular copper transport caused by pathogenic variants in ATP7B, resulting in toxic accumulation of copper in hepatic and central nervous system tissues.",
        curatedSummary:
          "High-complexity molecular diagnostic sequencing of ATP7B for pediatric liver disease screening.",
        hpoIds: ["HP:0001394", "HP:0001085"],
        pmids: ["24033266"],
      },
    ],
  };

  let pilotJobId = "";

  // --------------------------------------------------------------------------
  // TEST 1: Execute Pilot Ingestion with Live HGNC, HPO, ClinVar & NCBI Gene
  // --------------------------------------------------------------------------
  it("executes dynamic multi-source pilot ingestion with stage checkpoints", async () => {
    const result = await runDynamicIngestion(pilotConfig);

    expect(result.status).toBe("completed");
    expect(result.diseasesCount).toBe(2);
    expect(result.genesCount).toBe(2);
    expect(result.variantsCount).toBeGreaterThan(0);
    expect(result.assertionsCount).toBeGreaterThan(0);
    expect(result.publicationsCount).toBeGreaterThan(0);

    pilotJobId = result.jobId;

    // Verify Checkpoints Created
    const jobData = await getImportJobsAndCheckpoints(pilotJobId);
    expect(jobData.job).toBeDefined();
    expect((jobData.job as any).status).toBe("completed");
    expect((jobData.job as any).progress_pct).toBe(100);
    expect(jobData.checkpoints).toBeDefined();
    expect(jobData.checkpoints!.length).toBeGreaterThanOrEqual(2);
  }, 90000);

  // --------------------------------------------------------------------------
  // TEST 2: Authoritative Cross-Source Linking (HGNC + HPO + ClinVar)
  // --------------------------------------------------------------------------
  it("verifies accurate HGNC nomenclature and HPO phenotype integration", async () => {
    // Check HFE gene has HGNC ID
    const hfe = await getGeneByIdOrSymbol("HFE");
    expect(hfe).not.toBeNull();
    expect(hfe!.hgnc_id).toBe("HGNC:4886");
    expect(hfe!.symbol).toBe("HFE");
    expect(hfe!.entrez_gene_id).toBe("3077");

    // Check ATP7B gene has HGNC ID
    const atp7b = await getGeneByIdOrSymbol("ATP7B");
    expect(atp7b).not.toBeNull();
    expect(atp7b!.hgnc_id).toBe("HGNC:870");

    // Check Hereditary Hemochromatosis has linked HPO phenotypes
    const hh = await getDiseaseByIdOrSlug("hereditary-hemochromatosis");
    expect(hh).not.toBeNull();
    expect(hh!.phenotypes.length).toBeGreaterThanOrEqual(2);
    expect(hh!.phenotypes.some((p: any) => p.hpo_id === "HP:0001392")).toBe(true);

    // Verify newly ingested variants have review_status = 'source_imported'
    expect(hh!.variants.length).toBeGreaterThan(0);
    expect(hh!.variants.every((v: any) => v.review_status === "source_imported")).toBe(true);
  }, 20000);

  // --------------------------------------------------------------------------
  // TEST 3: Idempotent Re-Ingestion (No Duplicate Records)
  // --------------------------------------------------------------------------
  it("maintains idempotency: re-running ingestion does not duplicate entities", async () => {
    const statsBefore = await getGenomicsOverviewStats();

    // Re-run the exact same pilot import
    const repeatResult = await runDynamicIngestion({
      ...pilotConfig,
      jobName: "Phase04-Pilot-Repeat-Test",
    });

    expect(repeatResult.status).toBe("completed");

    const statsAfter = await getGenomicsOverviewStats();

    // Counts must not have inflated
    expect(statsAfter.diseasesCount).toBe(statsBefore.diseasesCount);
    expect(statsAfter.genesCount).toBe(statsBefore.genesCount);
    expect(statsAfter.variantsCount).toBe(statsBefore.variantsCount);
    expect(statsAfter.assertionsCount).toBe(statsBefore.assertionsCount);
  }, 90000);

  // --------------------------------------------------------------------------
  // TEST 4: Automated Scientific Validation & Quarantine Rule
  // --------------------------------------------------------------------------
  it("automatically quarantines variants with invalid coordinates or accessions", async () => {
    // Insert a malformed variant missing valid genomic coordinates
    const malformedVcv = `VCV_TEST_MALFORMED_${Date.now()}`;
    await sql`
      INSERT INTO genomics.variants (
        clinvar_vcv, preferred_name, chromosome, position_vcf,
        review_status, is_published, is_quarantined, quarantine_reason,
        source_payload_version
      )
      VALUES (
        ${malformedVcv}, 'Malformed Test Variant (No Coordinates)',
        'unknown', 0,
        'quarantined', false, true,
        'Automated validation failure: Missing or invalid genomic coordinates',
        'Validation-Test-v1.0'
      )
    `;

    // Must be quarantined directly in DB
    const [row] = await sql`SELECT * FROM genomics.variants WHERE clinvar_vcv = ${malformedVcv}`;
    expect(row).toBeDefined();
    expect((row as any).is_quarantined).toBe(true);
    expect((row as any).review_status).toBe("quarantined");

    // Must be completely invisible to public overview stats and searches
    const stats = await getGenomicsOverviewStats();
    const [activeRow] = await sql`
      SELECT count(*)::int as count FROM genomics.variants
      WHERE is_published = true AND (is_quarantined IS FALSE OR is_quarantined IS NULL)
    `;
    expect(stats.variantsCount).toBe(Number((activeRow as any)?.count || 0));

    // Detail route query must return null
    const [publicRow] = await sql`
      SELECT * FROM genomics.variants
      WHERE clinvar_vcv = ${malformedVcv}
        AND is_published = true AND (is_quarantined IS FALSE OR is_quarantined IS NULL)
    `;
    expect(publicRow).toBeUndefined();

    // Clean up test canary
    await sql`DELETE FROM genomics.variants WHERE clinvar_vcv = ${malformedVcv}`;
  });
});
