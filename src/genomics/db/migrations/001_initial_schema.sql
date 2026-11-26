-- ============================================================================
-- AKAHELIX Genomics Research Database: Schema Migration 001
-- Target Schema: genomics
-- Non-destructive, idempotent DDL
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS genomics;

-- 1. Schema Migrations Log Table
CREATE TABLE IF NOT EXISTS genomics.schema_migrations (
    version VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Scientific Data Sources Table
CREATE TABLE IF NOT EXISTS genomics.data_sources (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    base_url TEXT NOT NULL,
    description TEXT,
    license_type VARCHAR(128) NOT NULL,
    terms_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Dataset Versions Table
CREATE TABLE IF NOT EXISTS genomics.dataset_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    data_source_id VARCHAR(64) NOT NULL REFERENCES genomics.data_sources(id) ON DELETE RESTRICT,
    version_tag VARCHAR(128) NOT NULL,
    retrieval_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    record_count INT NOT NULL DEFAULT 0,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- 4. Import Jobs Tracking Table
CREATE TABLE IF NOT EXISTS genomics.import_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_name VARCHAR(128) NOT NULL,
    target_disease VARCHAR(255),
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    records_ingested INT NOT NULL DEFAULT 0,
    records_updated INT NOT NULL DEFAULT 0,
    errors JSONB NOT NULL DEFAULT '[]'::jsonb,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- 5. Diseases Table
CREATE TABLE IF NOT EXISTS genomics.diseases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    concept_id VARCHAR(64), -- MedGen CUI (e.g. C0005283)
    omim_id VARCHAR(32),
    orpha_code VARCHAR(32),
    mondo_id VARCHAR(32),
    icd10 VARCHAR(32),
    inheritance_mode VARCHAR(128),
    definition TEXT,
    source_record JSONB NOT NULL DEFAULT '{}'::jsonb,
    curated_summary TEXT,
    clinical_synopsis JSONB NOT NULL DEFAULT '{}'::jsonb,
    review_status VARCHAR(32) NOT NULL DEFAULT 'source_imported',
    is_published BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Genes Table
CREATE TABLE IF NOT EXISTS genomics.genes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    symbol VARCHAR(64) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    entrez_gene_id VARCHAR(32) UNIQUE,
    hgnc_id VARCHAR(32),
    ensembl_gene_id VARCHAR(64),
    omim_id VARCHAR(32),
    chromosome VARCHAR(16),
    cytogenetic_location VARCHAR(64),
    genomic_coordinates JSONB NOT NULL DEFAULT '{}'::jsonb,
    gene_type VARCHAR(64) NOT NULL DEFAULT 'protein-coding',
    summary TEXT,
    source_record JSONB NOT NULL DEFAULT '{}'::jsonb,
    curated_notes TEXT,
    review_status VARCHAR(32) NOT NULL DEFAULT 'source_imported',
    is_published BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Variants Table
CREATE TABLE IF NOT EXISTS genomics.variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinvar_vcv VARCHAR(64) UNIQUE,
    preferred_name VARCHAR(255) NOT NULL,
    hgvs_cdna TEXT,
    hgvs_protein TEXT,
    hgvs_genomic TEXT,
    dbsnp_id VARCHAR(32),
    variant_type VARCHAR(64) NOT NULL DEFAULT 'single nucleotide variant',
    molecular_consequence VARCHAR(128),
    assembly VARCHAR(16) NOT NULL DEFAULT 'GRCh38',
    chromosome VARCHAR(16),
    position_vcf BIGINT,
    ref_allele TEXT,
    alt_allele TEXT,
    source_record JSONB NOT NULL DEFAULT '{}'::jsonb,
    review_status VARCHAR(32) NOT NULL DEFAULT 'source_imported',
    is_published BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Disease-Gene Relationships Table
CREATE TABLE IF NOT EXISTS genomics.disease_gene_relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    disease_id UUID NOT NULL REFERENCES genomics.diseases(id) ON DELETE CASCADE,
    gene_id UUID NOT NULL REFERENCES genomics.genes(id) ON DELETE CASCADE,
    relationship_type VARCHAR(64) NOT NULL DEFAULT 'causative',
    evidence_level VARCHAR(64) NOT NULL DEFAULT 'Definitive',
    inheritance_pattern VARCHAR(128),
    source_id VARCHAR(64) REFERENCES genomics.data_sources(id),
    source_evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
    curator_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (disease_id, gene_id, relationship_type)
);

-- 9. Variant-Gene Relationships Table
CREATE TABLE IF NOT EXISTS genomics.variant_gene_relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    variant_id UUID NOT NULL REFERENCES genomics.variants(id) ON DELETE CASCADE,
    gene_id UUID NOT NULL REFERENCES genomics.genes(id) ON DELETE CASCADE,
    relationship_type VARCHAR(64) NOT NULL DEFAULT 'located_in',
    exon_number INT,
    intron_number INT,
    consequence VARCHAR(128),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (variant_id, gene_id)
);

-- 10. Variant-Disease Relationships Table
CREATE TABLE IF NOT EXISTS genomics.variant_disease_relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    variant_id UUID NOT NULL REFERENCES genomics.variants(id) ON DELETE CASCADE,
    disease_id UUID NOT NULL REFERENCES genomics.diseases(id) ON DELETE CASCADE,
    clinical_significance VARCHAR(64) NOT NULL,
    review_status_clinvar VARCHAR(128),
    gold_stars INT NOT NULL DEFAULT 0,
    source_evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (variant_id, disease_id)
);

-- 11. Variant Clinical Assertions Table (ClinVar SCV records)
CREATE TABLE IF NOT EXISTS genomics.variant_clinical_assertions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    variant_id UUID NOT NULL REFERENCES genomics.variants(id) ON DELETE CASCADE,
    rcv_accession VARCHAR(64),
    scv_accession VARCHAR(64),
    submitter_name VARCHAR(255) NOT NULL,
    clinical_significance VARCHAR(64) NOT NULL,
    disease_name VARCHAR(255),
    assertion_criteria TEXT,
    date_last_evaluated DATE,
    submission_date DATE,
    review_status VARCHAR(128),
    citations JSONB NOT NULL DEFAULT '[]'::jsonb,
    raw_assertion JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. Phenotypes Table (HPO Terms)
CREATE TABLE IF NOT EXISTS genomics.phenotypes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hpo_id VARCHAR(32) UNIQUE NOT NULL,
    term VARCHAR(255) NOT NULL,
    definition TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13. Disease-Phenotype Relationships Table
CREATE TABLE IF NOT EXISTS genomics.disease_phenotype_relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    disease_id UUID NOT NULL REFERENCES genomics.diseases(id) ON DELETE CASCADE,
    phenotype_id UUID NOT NULL REFERENCES genomics.phenotypes(id) ON DELETE CASCADE,
    frequency VARCHAR(64),
    source_evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (disease_id, phenotype_id)
);

-- 14. Publications Table (PubMed)
CREATE TABLE IF NOT EXISTS genomics.publications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pmid VARCHAR(32) UNIQUE NOT NULL,
    pmcid VARCHAR(32),
    doi VARCHAR(128),
    title TEXT NOT NULL,
    authors JSONB NOT NULL DEFAULT '[]'::jsonb,
    journal VARCHAR(255),
    pub_year INT,
    pub_date VARCHAR(64),
    abstract TEXT,
    source_record JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 15. Scientific References Crosswalk Table
CREATE TABLE IF NOT EXISTS genomics.scientific_references (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    publication_id UUID NOT NULL REFERENCES genomics.publications(id) ON DELETE CASCADE,
    entity_type VARCHAR(32) NOT NULL, -- 'disease', 'gene', 'variant', 'assertion'
    entity_id UUID NOT NULL,
    evidence_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (publication_id, entity_type, entity_id)
);

-- 16. Scientific Reviews Table (Curation & Governance Queue)
CREATE TABLE IF NOT EXISTS genomics.scientific_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(32) NOT NULL,
    entity_id UUID NOT NULL,
    reviewer_email VARCHAR(255) NOT NULL,
    reviewer_name VARCHAR(255) NOT NULL,
    action VARCHAR(32) NOT NULL, -- 'reviewed', 'flagged', 'annotated', 'approved', 'published'
    notes TEXT NOT NULL,
    previous_status VARCHAR(32),
    new_status VARCHAR(32),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 17. Audit Logs Table (Full Governance Tracking)
CREATE TABLE IF NOT EXISTS genomics.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_email VARCHAR(255) NOT NULL,
    action VARCHAR(64) NOT NULL,
    entity_type VARCHAR(64) NOT NULL,
    entity_id VARCHAR(128) NOT NULL,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip_address VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for Fast Querying & Search
CREATE INDEX IF NOT EXISTS idx_genomics_diseases_slug ON genomics.diseases(slug);
CREATE INDEX IF NOT EXISTS idx_genomics_diseases_concept ON genomics.diseases(concept_id);
CREATE INDEX IF NOT EXISTS idx_genomics_diseases_omim ON genomics.diseases(omim_id);
CREATE INDEX IF NOT EXISTS idx_genomics_genes_symbol ON genomics.genes(symbol);
CREATE INDEX IF NOT EXISTS idx_genomics_genes_entrez ON genomics.genes(entrez_gene_id);
CREATE INDEX IF NOT EXISTS idx_genomics_variants_vcv ON genomics.variants(clinvar_vcv);
CREATE INDEX IF NOT EXISTS idx_genomics_variants_dbsnp ON genomics.variants(dbsnp_id);
CREATE INDEX IF NOT EXISTS idx_genomics_variants_pos ON genomics.variants(chromosome, position_vcf);
CREATE INDEX IF NOT EXISTS idx_genomics_dgr_disease ON genomics.disease_gene_relationships(disease_id);
CREATE INDEX IF NOT EXISTS idx_genomics_dgr_gene ON genomics.disease_gene_relationships(gene_id);
CREATE INDEX IF NOT EXISTS idx_genomics_vgr_variant ON genomics.variant_gene_relationships(variant_id);
CREATE INDEX IF NOT EXISTS idx_genomics_vgr_gene ON genomics.variant_gene_relationships(gene_id);
CREATE INDEX IF NOT EXISTS idx_genomics_vdr_variant ON genomics.variant_disease_relationships(variant_id);
CREATE INDEX IF NOT EXISTS idx_genomics_vdr_disease ON genomics.variant_disease_relationships(disease_id);
CREATE INDEX IF NOT EXISTS idx_genomics_vca_variant ON genomics.variant_clinical_assertions(variant_id);
CREATE INDEX IF NOT EXISTS idx_genomics_dpr_disease ON genomics.disease_phenotype_relationships(disease_id);
CREATE INDEX IF NOT EXISTS idx_genomics_sci_ref_entity ON genomics.scientific_references(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_genomics_sci_ref_pub ON genomics.scientific_references(publication_id);
CREATE INDEX IF NOT EXISTS idx_genomics_reviews_entity ON genomics.scientific_reviews(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_genomics_audit_created ON genomics.audit_logs(created_at DESC);
