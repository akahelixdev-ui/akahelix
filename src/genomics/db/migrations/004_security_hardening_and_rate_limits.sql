-- ============================================================================
-- Migration 004: Security Hardening, Distributed Rate Limiting & Constraints
-- ============================================================================

-- 1. Distributed Rate Limits Table
CREATE TABLE IF NOT EXISTS genomics.rate_limits (
    resource VARCHAR(64) PRIMARY KEY,
    last_request_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    request_count INT NOT NULL DEFAULT 0,
    window_start_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed initial row for NCBI rate limiter
INSERT INTO genomics.rate_limits (resource, last_request_at)
VALUES ('ncbi_eutils', NOW())
ON CONFLICT (resource) DO NOTHING;

-- 2. Ingestion Mutex Locks Table (prevents concurrent pipeline collisions)
CREATE TABLE IF NOT EXISTS genomics.ingestion_locks (
    lock_name VARCHAR(64) PRIMARY KEY,
    acquired_by VARCHAR(255) NOT NULL,
    acquired_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);

-- 3. Audit and Provenance Columns on Variants, Genes, Diseases
ALTER TABLE genomics.variants 
ADD COLUMN IF NOT EXISTS quarantine_reason TEXT,
ADD COLUMN IF NOT EXISTS correction_history JSONB NOT NULL DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS source_payload_version VARCHAR(64),
ADD COLUMN IF NOT EXISTS source_retrieval_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS is_quarantined BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE genomics.genes 
ADD COLUMN IF NOT EXISTS quarantine_reason TEXT,
ADD COLUMN IF NOT EXISTS correction_history JSONB NOT NULL DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS source_payload_version VARCHAR(64),
ADD COLUMN IF NOT EXISTS source_retrieval_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS is_quarantined BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE genomics.diseases 
ADD COLUMN IF NOT EXISTS quarantine_reason TEXT,
ADD COLUMN IF NOT EXISTS correction_history JSONB NOT NULL DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS source_payload_version VARCHAR(64),
ADD COLUMN IF NOT EXISTS source_retrieval_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS is_quarantined BOOLEAN NOT NULL DEFAULT FALSE;

-- 4. Deduplicate existing clinical assertions before adding constraint
DELETE FROM genomics.variant_clinical_assertions a
WHERE a.id IN (
    SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (
            PARTITION BY variant_id, scv_accession 
            ORDER BY created_at DESC
        ) as rnum
        FROM genomics.variant_clinical_assertions
        WHERE scv_accession IS NOT NULL
    ) sub
    WHERE sub.rnum > 1
);

-- 5. Add unique index on variant clinical assertions to guarantee idempotency
CREATE UNIQUE INDEX IF NOT EXISTS uq_vca_variant_scv ON genomics.variant_clinical_assertions (variant_id, scv_accession);

-- 6. Indexes for quarantine filtering
CREATE INDEX IF NOT EXISTS idx_genomics_variants_quarantine ON genomics.variants(is_quarantined, is_published);
CREATE INDEX IF NOT EXISTS idx_genomics_genes_quarantine ON genomics.genes(is_quarantined, is_published);
CREATE INDEX IF NOT EXISTS idx_genomics_diseases_quarantine ON genomics.diseases(is_quarantined, is_published);
