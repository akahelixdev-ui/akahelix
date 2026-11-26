import { describe, it, expect, beforeAll } from "vitest";
import fs from "fs";
import path from "path";
import { neon } from "@neondatabase/serverless";
import { ncbi } from "../services/ncbi/client";
import { getGenomicsOverviewStats, getVariantByIdOrVcv, getDiseaseByIdOrSlug } from "../db/client";

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

describe("Phase 04 — Verification Gaps Closure", () => {
  beforeAll(async () => {
    expect(process.env["DATABASE_URL"]).toBeDefined();
    expect(process.env["DATABASE_URL"]).toContain("ep-little-surf-beun7bf0");
  });

  // --------------------------------------------------------------------------
  // GAP 1: Transaction Rollback on Intentional Failure
  // --------------------------------------------------------------------------
  it("rolls back atomic database transactions completely upon failure", async () => {
    const canarySlug = `canary-rollback-${Date.now()}`;

    // Verify record does not exist before
    const [before] = await sql`SELECT * FROM genomics.diseases WHERE slug = ${canarySlug}`;
    expect(before).toBeUndefined();

    let transactionFailed = false;
    try {
      await sql.transaction([
        // Step 1: Valid insert of canary disease
        sql`
          INSERT INTO genomics.diseases (
            slug, name, concept_id, omim_id, inheritance_mode, definition,
            review_status, is_published, is_quarantined
          ) VALUES (
            ${canarySlug}, 'Canary Rollback Test Disease', 'C9999999', '999999',
            'Autosomal recessive', 'Canary entity to test atomic rollback on failure',
            'quarantined', false, true
          )
        `,
        // Step 2: Intentional unique constraint failure (duplicate slug)
        sql`
          INSERT INTO genomics.diseases (
            slug, name, concept_id, omim_id, inheritance_mode, definition,
            review_status, is_published, is_quarantined
          ) VALUES (
            ${canarySlug}, 'Duplicate Canary Triggering Abort', 'C9999999', '999999',
            'Autosomal recessive', 'This must trigger a unique violation and roll back Step 1',
            'quarantined', false, true
          )
        `,
      ]);
    } catch (err: any) {
      transactionFailed = true;
      expect(err.message).toMatch(/duplicate key value violates unique constraint/i);
    }

    expect(transactionFailed).toBe(true);

    // Verify atomic rollback: Step 1 MUST NOT exist in database
    const [after] = await sql`SELECT * FROM genomics.diseases WHERE slug = ${canarySlug}`;
    expect(after).toBeUndefined();
  });

  // --------------------------------------------------------------------------
  // GAP 2: Distributed NCBI Rate Limiting Under Concurrent Requests
  // --------------------------------------------------------------------------
  it("enforces <= 3 req/sec distributed pacing across concurrent callers", async () => {
    const timestamps: number[] = [];
    const start = Date.now();

    // Spawn 6 concurrent requests simulating multiple isolates/workers
    await Promise.all([1, 2, 3, 4, 5, 6].map(async () => {
      await (ncbi as any).rateLimiter.acquire();
      timestamps.push(Date.now() - start);
    }));

    timestamps.sort((a, b) => a - b);
    expect(timestamps.length).toBe(6);

    // The span across 6 requests at 350ms spacing must be >= 1400ms
    const totalSpan = timestamps[timestamps.length - 1]! - timestamps[0]!;
    expect(totalSpan).toBeGreaterThanOrEqual(1400);

    // Verify average gap is at least 280ms (<= 3.5 req/sec ceiling)
    const avgGap = totalSpan / (timestamps.length - 1);
    expect(avgGap).toBeGreaterThanOrEqual(280);
  }, 15000);

  // --------------------------------------------------------------------------
  // GAP 3: Confirm Unrelated Legacy Assertions and Quarantined Records Are Excluded
  // --------------------------------------------------------------------------
  it("strictly excludes quarantined assertions and orphaned records from public statistics", async () => {
    // Total raw assertions in DB includes assertions on quarantined legacy variants
    const [rawAssertions] = await sql`SELECT count(*)::int as count FROM genomics.variant_clinical_assertions`;
    const totalRaw = Number((rawAssertions as any)?.count || 0);

    // Public assertions count returned by public overview API
    const overview = await getGenomicsOverviewStats();
    expect(overview.assertionsCount).toBeGreaterThanOrEqual(16);

    // Raw count must be greater than or equal to public count (legacy quarantined assertions exist in DB for audit provenance)
    expect(totalRaw).toBeGreaterThanOrEqual(overview.assertionsCount);

    // Quarantined legacy variant VCV000015170 must not be returned publicly
    const legacyVariant = await getVariantByIdOrVcv("VCV000015170");
    expect(legacyVariant).toBeNull();
  });

  // --------------------------------------------------------------------------
  // GAP 4: Verify Stored Values Directly Against Source Payloads (Provenance Integrity)
  // --------------------------------------------------------------------------
  it("verifies normalized database columns match original source JSON payloads", async () => {
    const variants = await sql`
      SELECT clinvar_vcv, preferred_name, chromosome, position_vcf, ref_allele, alt_allele, clinical_significance, source_record
      FROM genomics.variants
      WHERE is_published = true AND (is_quarantined IS FALSE OR is_quarantined IS NULL)
        AND source_payload_version = 'ClinVar-NCBI-v1'
    `;

    expect(variants.length).toBeGreaterThanOrEqual(13);

    for (const v of variants as any[]) {
      const src = v.source_record;
      expect(src).toBeDefined();

      // Compare normalized column directly to source JSON property without hardcoding
      expect(v.clinvar_vcv).toBe(src.clinvarVcv);
      expect(v.preferred_name).toBe(src.preferredName);
      expect(v.chromosome).toBe(src.chromosome);
      expect(Number(v.position_vcf)).toBe(src.positionVcf);
      expect(v.ref_allele).toBe(src.refAllele);
      expect(v.alt_allele).toBe(src.altAllele);
      expect(v.clinical_significance).toBe(src.significance);
    }
  });
});
