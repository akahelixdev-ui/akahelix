-- ============================================================================
-- Migration 007: Automated Synchronization, Inngest & Classification History
-- Non-destructive, idempotent migration for Phase 05.
-- ============================================================================

-- 1. Extend import_jobs for asynchronous background orchestration & cancellation
ALTER TABLE genomics.import_jobs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE genomics.import_jobs ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE genomics.import_jobs ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
ALTER TABLE genomics.import_jobs ADD COLUMN IF NOT EXISTS job_type VARCHAR(64) DEFAULT 'import';

-- Backfill created_at with started_at if started_at exists
UPDATE genomics.import_jobs SET created_at = started_at WHERE created_at IS NULL AND started_at IS NOT NULL;

-- 2. Classification History Table
-- Preserves complete history of ClinVar classification changes, gold star changes,
-- and conflicting assertions over time for scientific provenance.
CREATE TABLE IF NOT EXISTS genomics.classification_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    variant_id UUID NOT NULL REFERENCES genomics.variants(id) ON DELETE CASCADE,
    clinvar_vcv VARCHAR(64) NOT NULL,
    previous_classification VARCHAR(128),
    new_classification VARCHAR(128) NOT NULL,
    previous_gold_stars INT,
    new_gold_stars INT,
    previous_review_status VARCHAR(64),
    new_review_status VARCHAR(64),
    source_data_source VARCHAR(64) REFERENCES genomics.data_sources(id) DEFAULT 'ncbi_clinvar',
    source_record_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    change_summary TEXT,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_classification_history_variant_id ON genomics.classification_history(variant_id);
CREATE INDEX IF NOT EXISTS idx_classification_history_clinvar_vcv ON genomics.classification_history(clinvar_vcv);
CREATE INDEX IF NOT EXISTS idx_classification_history_changed_at ON genomics.classification_history(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_import_jobs_created_at ON genomics.import_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_import_jobs_status ON genomics.import_jobs(status);
