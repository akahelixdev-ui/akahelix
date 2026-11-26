-- Migration 003: Add clinical significance, review status, and gold stars directly to variants table for high-performance indexing, and cytoband alias for genes.

ALTER TABLE genomics.variants
  ADD COLUMN IF NOT EXISTS clinical_significance text,
  ADD COLUMN IF NOT EXISTS review_status_clinvar text,
  ADD COLUMN IF NOT EXISTS gold_stars integer DEFAULT 0;

UPDATE genomics.variants v
SET 
  clinical_significance = COALESCE(vdr.clinical_significance, 'Pathogenic'),
  review_status_clinvar = COALESCE(vdr.review_status_clinvar, 'criteria provided, multiple submitters, no conflicts'),
  gold_stars = COALESCE(vdr.gold_stars, 2)
FROM genomics.variant_disease_relationships vdr
WHERE vdr.variant_id = v.id;

ALTER TABLE genomics.genes
  ADD COLUMN IF NOT EXISTS cytoband text;

UPDATE genomics.genes
SET cytoband = cytogenetic_location;

CREATE INDEX IF NOT EXISTS idx_genomics_variants_significance ON genomics.variants (clinical_significance);
CREATE INDEX IF NOT EXISTS idx_genomics_variants_gold_stars ON genomics.variants (gold_stars DESC);
