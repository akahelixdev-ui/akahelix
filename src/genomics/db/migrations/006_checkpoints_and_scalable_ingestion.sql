-- ============================================================================
-- Migration 006: Checkpoints, Scalable Ingestion & External Sources
-- ============================================================================

-- 1. Ingestion Checkpoints Table for Resumable Batch Processing
CREATE TABLE IF NOT EXISTS genomics.ingestion_checkpoints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES genomics.import_jobs(id) ON DELETE CASCADE,
    stage VARCHAR(64) NOT NULL,
    last_cursor VARCHAR(255),
    batch_index INT NOT NULL DEFAULT 0,
    total_batches INT,
    records_processed INT NOT NULL DEFAULT 0,
    checkpoint_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    status VARCHAR(32) NOT NULL DEFAULT 'in_progress',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(job_id, stage)
);

-- 2. Add progress and config columns to import_jobs
ALTER TABLE genomics.import_jobs
ADD COLUMN IF NOT EXISTS config JSONB NOT NULL DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS progress_pct INT NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS current_stage VARCHAR(64);

-- 3. Register HGNC and HPO data sources
INSERT INTO genomics.data_sources (
    id, name, base_url, description, license_type, terms_url, is_active
)
VALUES 
    (
        'hgnc',
        'HGNC (HUGO Gene Nomenclature Committee)',
        'https://rest.genenames.org',
        'Authoritative resource for approved human gene nomenclature and symbol cross-references.',
        'Open Access / CC0',
        'https://www.genenames.org/about/license/',
        true
    ),
    (
        'hpo',
        'Human Phenotype Ontology',
        'https://ontology.jax.org',
        'Standardized vocabulary of phenotypic abnormalities encountered in human disease.',
        'Open Access / CC-BY-4.0',
        'https://hpo.jax.org/app/license',
        true
    )
ON CONFLICT (id) DO UPDATE SET
    base_url = EXCLUDED.base_url,
    description = EXCLUDED.description,
    license_type = EXCLUDED.license_type,
    terms_url = EXCLUDED.terms_url,
    is_active = true;

-- 4. Index on checkpoints for quick lookups during job resumption
CREATE INDEX IF NOT EXISTS idx_ingestion_checkpoints_job_stage 
ON genomics.ingestion_checkpoints(job_id, stage);
