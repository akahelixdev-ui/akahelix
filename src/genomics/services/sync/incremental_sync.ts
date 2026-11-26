import { neon } from "@neondatabase/serverless";
import { ncbi } from "../ncbi/client";
import { hgnc } from "../hgnc/client";
import { hpo } from "../hpo/client";
import { acquireIngestionLock, releaseIngestionLock } from "../ingestion/pipeline";

function getSql() {
  const url = process.env["DATABASE_URL"];
  if (!url) throw new Error("DATABASE_URL is required for genomics synchronization engine.");
  return neon(url);
}

export interface SyncConfig {
  jobName?: string;
  geneSymbols?: string[];
  maxVariantsPerGene?: number;
  syncType?: "incremental" | "full";
  skipClinVar?: boolean;
}

export interface SyncResult {
  jobId: string;
  status: "completed" | "failed" | "cancelled";
  genesSynced: number;
  phenotypesSynced: number;
  variantsSynced: number;
  classificationChanges: number;
  publicationsSynced: number;
  errors: string[];
}

/**
 * Check if the current job has been cancelled by an administrator or Inngest event.
 */
async function checkCancellation(jobId: string): Promise<boolean> {
  const sql = getSql();
  const [row] = await sql`SELECT status FROM genomics.import_jobs WHERE id = ${jobId}`;
  return (row as any)?.status === "cancelled";
}

/**
 * Log a stage checkpoint to genomics.ingestion_checkpoints and update import_jobs.
 */
async function recordCheckpoint(
  jobId: string,
  stage: string,
  status: "pending" | "running" | "completed" | "failed",
  progressPct: number,
  processedItems: number = 0,
  totalItems: number = 0,
  details: any = {}
) {
  const sql = getSql();
  await sql`
    INSERT INTO genomics.ingestion_checkpoints (
      job_id, stage, status, records_processed, total_batches, checkpoint_data, updated_at
    )
    VALUES (
      ${jobId}, ${stage}, ${status}, ${processedItems}, ${totalItems},
      ${JSON.stringify(details)}::jsonb,
      NOW()
    )
    ON CONFLICT (job_id, stage) DO UPDATE SET
      status = EXCLUDED.status,
      records_processed = EXCLUDED.records_processed,
      total_batches = EXCLUDED.total_batches,
      checkpoint_data = EXCLUDED.checkpoint_data,
      updated_at = NOW()
  `;

  await sql`
    UPDATE genomics.import_jobs
    SET current_stage = ${stage},
        progress_pct = ${progressPct}
    WHERE id = ${jobId}
  `;
}

/**
 * Executes multi-source incremental synchronization.
 * Checks for modifications across HGNC, HPO, NCBI Gene, ClinVar, and PubMed.
 * Detects and preserves ClinVar classification shifts in genomics.classification_history.
 * Enforces cancellation checks before every batch step.
 */
export async function runIncrementalSync(
  config: SyncConfig = {},
  existingJobId?: string
): Promise<SyncResult> {
  const sql = getSql();
  const errors: string[] = [];

  let jobId = existingJobId || "";
  let genesSynced = 0;
  let phenotypesSynced = 0;
  let variantsSynced = 0;
  let classificationChanges = 0;
  let publicationsSynced = 0;

  // 1. Initialize or Bind Import Job Record
  if (!jobId) {
    const [job] = await sql`
      INSERT INTO genomics.import_jobs (
        job_name, target_disease, status, job_type, records_ingested, records_updated,
        progress_pct, current_stage, config, started_at, created_at
      )
      VALUES (
        ${config.jobName || "Automated-Incremental-Sync"},
        'Active Curated Repertoire',
        'running',
        ${config.syncType || "incremental"},
        0, 0, 5, 'initializing',
        ${JSON.stringify(config)}::jsonb,
        NOW(), NOW()
      )
      RETURNING id
    `;
    jobId = (job as any).id;
  } else {
    await sql`
      UPDATE genomics.import_jobs
      SET status = 'running',
          started_at = COALESCE(started_at, NOW()),
          current_stage = 'initializing',
          progress_pct = 5
      WHERE id = ${jobId}
    `;
  }

  const workerId = `sync:${jobId}:${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  // 2. Acquire Distributed Ingestion Lock
  const lockAcquired = await acquireIngestionLock(workerId);
  if (!lockAcquired) {
    const err = "Concurrent sync conflict: An active genomics ingestion or sync lock is currently held.";
    await sql`
      UPDATE genomics.import_jobs
      SET status = 'failed',
          errors = ${JSON.stringify([err])}::jsonb,
          completed_at = NOW()
      WHERE id = ${jobId}
    `;
    return {
      jobId,
      status: "failed",
      genesSynced: 0,
      phenotypesSynced: 0,
      variantsSynced: 0,
      classificationChanges: 0,
      publicationsSynced: 0,
      errors: [err],
    };
  }

  try {
    // ------------------------------------------------------------------------
    // STAGE 1: Synchronize HGNC Gene Nomenclature
    // ------------------------------------------------------------------------
    if (await checkCancellation(jobId)) throw new Error("SYNC_CANCELLED");
    await recordCheckpoint(jobId, "sync_hgnc", "running", 15);

    const activeGenes = await sql`
      SELECT id, symbol, entrez_gene_id, hgnc_id, chromosome
      FROM genomics.genes
      WHERE is_published = true AND (is_quarantined IS FALSE OR is_quarantined IS NULL)
      ORDER BY symbol ASC
    `;

    for (const gene of activeGenes as any[]) {
      if (await checkCancellation(jobId)) throw new Error("SYNC_CANCELLED");

      try {
        const hgncData = await hgnc.getGeneBySymbol(gene.symbol);
        if (hgncData && hgncData.hgncId && hgncData.hgncId !== gene.hgnc_id) {
          await sql`
            UPDATE genomics.genes
            SET hgnc_id = ${hgncData.hgncId},
                updated_at = NOW()
            WHERE id = ${gene.id}
          `;
          genesSynced++;
        } else {
          genesSynced++;
        }
      } catch (err: any) {
        errors.push(`HGNC sync for ${gene.symbol}: ${err.message}`);
      }
    }
    await recordCheckpoint(jobId, "sync_hgnc", "completed", 30, genesSynced, activeGenes.length);

    // ------------------------------------------------------------------------
    // STAGE 2: Synchronize HPO Clinical Phenotypes
    // ------------------------------------------------------------------------
    if (await checkCancellation(jobId)) throw new Error("SYNC_CANCELLED");
    await recordCheckpoint(jobId, "sync_hpo", "running", 35);

    const activePhenotypes = await sql`SELECT id, hpo_id, term FROM genomics.phenotypes LIMIT 20`;
    for (const pt of activePhenotypes as any[]) {
      if (await checkCancellation(jobId)) throw new Error("SYNC_CANCELLED");

      try {
        const hpoTerm = await hpo.getTerm(pt.hpo_id);
        if (hpoTerm && hpoTerm.name && hpoTerm.name !== pt.term) {
          await sql`
            UPDATE genomics.phenotypes
            SET term = ${hpoTerm.name},
                definition = COALESCE(${hpoTerm.definition || null}, definition)
            WHERE id = ${pt.id}
          `;
        }
        phenotypesSynced++;
      } catch (err: any) {
        errors.push(`HPO sync for ${pt.hpo_id}: ${err.message}`);
      }
    }
    await recordCheckpoint(jobId, "sync_hpo", "completed", 50, phenotypesSynced, activePhenotypes.length);

    // ------------------------------------------------------------------------
    // STAGE 3: ClinVar Re-Check & Classification Drift Detection
    // ------------------------------------------------------------------------
    if (await checkCancellation(jobId)) throw new Error("SYNC_CANCELLED");
    await recordCheckpoint(jobId, "sync_clinvar", "running", 55);

    if (!config.skipClinVar) {
      const activeVariants = await sql`
        SELECT id, clinvar_vcv, preferred_name, clinical_significance, gold_stars, review_status_clinvar, source_record
        FROM genomics.variants
        WHERE is_published = true AND (is_quarantined IS FALSE OR is_quarantined IS NULL)
        ORDER BY updated_at ASC
        LIMIT 15
      `;

      for (const v of activeVariants as any[]) {
        if (await checkCancellation(jobId)) throw new Error("SYNC_CANCELLED");

        try {
          const clinvarRecord = await ncbi.getVariation(v.clinvar_vcv);
          if (clinvarRecord) {
            const currentSig = v.clinical_significance;
            const latestSig = clinvarRecord.clinicalSignificance;
            const currentStars = v.gold_stars;
            const latestStars = clinvarRecord.goldStars;
            const currentReview = v.review_status_clinvar;
            const latestReview = clinvarRecord.reviewStatus;

            // Check if authoritative classification or star level has changed
            if (
              (latestSig && latestSig !== currentSig) ||
              (latestStars !== undefined && latestStars !== currentStars) ||
              (latestReview && latestReview !== currentReview)
            ) {
              // Record in classification_history
              await sql`
                INSERT INTO genomics.classification_history (
                  variant_id, clinvar_vcv, previous_classification, new_classification,
                  previous_gold_stars, new_gold_stars, previous_review_status, new_review_status,
                  source_record_snapshot, change_summary
                )
                VALUES (
                  ${v.id}, ${v.clinvar_vcv}, ${currentSig}, ${latestSig || currentSig},
                  ${currentStars}, ${latestStars ?? currentStars},
                  ${currentReview}, ${latestReview || currentReview},
                  ${JSON.stringify(clinvarRecord.raw || {})}::jsonb,
                  ${`Authoritative ClinVar update detected during sync: ${currentSig} (${currentStars}*) -> ${latestSig} (${latestStars}*)`}
                )
              `;

              // Preserve existing normalized source_record provenance while attaching latest raw ClinVar summary
              const existingSource =
                v.source_record && typeof v.source_record === "object" ? v.source_record : {};
              const mergedSourceRecord = {
                ...existingSource,
                significance: latestSig || currentSig,
                goldStars: latestStars ?? currentStars,
                reviewStatusClinvar: latestReview || currentReview,
                rawClinVarSummary: clinvarRecord.raw || existingSource.rawClinVarSummary || null,
                lastSyncedAt: new Date().toISOString(),
              };

              // Update variant in database
              await sql`
                UPDATE genomics.variants
                SET clinical_significance = ${latestSig || currentSig},
                    gold_stars = ${latestStars ?? currentStars},
                    review_status_clinvar = ${latestReview || currentReview},
                    source_record = ${JSON.stringify(mergedSourceRecord)}::jsonb,
                    source_retrieval_date = NOW(),
                    updated_at = NOW()
                WHERE id = ${v.id}
              `;

              // Record in audit log
              await sql`
                INSERT INTO genomics.audit_logs (
                  actor_email, action, entity_type, entity_id, details
                )
                VALUES (
                  'system@akahelix.com', 'clinvar_classification_shift', 'variant', ${v.id},
                  ${JSON.stringify({
                    vcv: v.clinvar_vcv,
                    from: currentSig,
                    to: latestSig,
                    stars: { from: currentStars, to: latestStars },
                  })}::jsonb
                )
              `;

              classificationChanges++;
            }
            variantsSynced++;
          }
        } catch (err: any) {
          errors.push(`ClinVar sync for ${v.clinvar_vcv}: ${err.message}`);
        }
      }
    }
    await recordCheckpoint(jobId, "sync_clinvar", "completed", 75, variantsSynced);

    // ------------------------------------------------------------------------
    // STAGE 4: PubMed Literature Refresh
    // ------------------------------------------------------------------------
    if (await checkCancellation(jobId)) throw new Error("SYNC_CANCELLED");
    await recordCheckpoint(jobId, "sync_pubmed", "running", 80);

    const activePubs = await sql`SELECT id, pmid, title FROM genomics.publications LIMIT 10`;
    for (const pub of activePubs as any[]) {
      if (await checkCancellation(jobId)) throw new Error("SYNC_CANCELLED");

      try {
        const pubData = await ncbi.getPubMedArticle(pub.pmid);
        if (pubData && pubData.title && pubData.title !== pub.title) {
          await sql`
            UPDATE genomics.publications
            SET title = ${pubData.title},
                journal = COALESCE(${pubData.journal}, journal)
            WHERE id = ${pub.id}
          `;
        }
        publicationsSynced++;
      } catch (err: any) {
        errors.push(`PubMed sync for PMID ${pub.pmid}: ${err.message}`);
      }
    }
    await recordCheckpoint(jobId, "sync_pubmed", "completed", 95, publicationsSynced, activePubs.length);

    // ------------------------------------------------------------------------
    // STAGE 5: Finalize Job Record
    // ------------------------------------------------------------------------
    await sql`
      UPDATE genomics.import_jobs
      SET status = 'completed',
          progress_pct = 100,
          current_stage = 'finalized',
          records_ingested = ${genesSynced + phenotypesSynced + variantsSynced},
          records_updated = ${classificationChanges},
          errors = ${JSON.stringify(errors)}::jsonb,
          completed_at = NOW()
      WHERE id = ${jobId}
    `;

    // Record dataset version update
    await sql`
      INSERT INTO genomics.dataset_versions (
        data_source_id, version_tag, retrieval_date, record_count, metadata
      )
      VALUES (
        'ncbi_clinvar', ${'Sync-' + new Date().toISOString().split('T')[0]},
        NOW(), ${variantsSynced},
        ${JSON.stringify({ classificationChanges, errorsCount: errors.length })}::jsonb
      )
    `;

    return {
      jobId,
      status: "completed",
      genesSynced,
      phenotypesSynced,
      variantsSynced,
      classificationChanges,
      publicationsSynced,
      errors,
    };
  } catch (err: any) {
    if (err.message === "SYNC_CANCELLED") {
      console.log(`==> Sync Job ${jobId} was cancelled by administrator.`);
      await sql`
        UPDATE genomics.import_jobs
        SET status = 'cancelled',
            cancelled_at = NOW(),
            cancellation_reason = 'Cancelled by administrator or Inngest signal',
            current_stage = 'cancelled'
        WHERE id = ${jobId}
      `;

      await sql`
        INSERT INTO genomics.audit_logs (actor_email, action, entity_type, entity_id, details)
        VALUES ('admin@akahelix.com', 'sync_cancelled', 'import_job', ${jobId}, '{"status":"cancelled"}'::jsonb)
      `;

      return {
        jobId,
        status: "cancelled",
        genesSynced,
        phenotypesSynced,
        variantsSynced,
        classificationChanges,
        publicationsSynced,
        errors: ["Job cancelled by administrator."],
      };
    }

    console.error(`==> Sync Job ${jobId} failed:`, err);
    await sql`
      UPDATE genomics.import_jobs
      SET status = 'failed',
          errors = ${JSON.stringify([...errors, err.message])}::jsonb,
          completed_at = NOW()
      WHERE id = ${jobId}
    `;

    return {
      jobId,
      status: "failed",
      genesSynced,
      phenotypesSynced,
      variantsSynced,
      classificationChanges,
      publicationsSynced,
      errors: [...errors, err.message],
    };
  } finally {
    await releaseIngestionLock(workerId);
  }
}
