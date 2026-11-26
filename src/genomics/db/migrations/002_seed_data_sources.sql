-- ============================================================================
-- AKAHELIX Genomics Research Database: Schema Migration 002
-- Seed authoritative biomedical data sources with licensing and terms
-- ============================================================================

INSERT INTO genomics.data_sources (id, name, base_url, description, license_type, terms_url, is_active)
VALUES
    (
        'ncbi_gene',
        'NCBI Gene (National Center for Biotechnology Information)',
        'https://www.ncbi.nlm.nih.gov/gene/',
        'Gene-specific information supplying tracked nomenclature, genomic coordinates, and sequence attributes.',
        'Public Domain (US Government Work)',
        'https://www.ncbi.nlm.nih.gov/home/about/policies/',
        TRUE
    ),
    (
        'ncbi_clinvar',
        'NCBI ClinVar',
        'https://www.ncbi.nlm.nih.gov/clinvar/',
        'Public archive of reports of the relationships among human variations and phenotypes, with supporting evidence.',
        'Public Domain (US Government Work)',
        'https://www.ncbi.nlm.nih.gov/clinvar/docs/maintenance_use/',
        TRUE
    ),
    (
        'ncbi_medgen',
        'NCBI MedGen',
        'https://www.ncbi.nlm.nih.gov/medgen/',
        'Portal to information about conditions and phenotypes related to medical genetics.',
        'Public Domain (US Government Work)',
        'https://www.ncbi.nlm.nih.gov/medgen/docs/policies/',
        TRUE
    ),
    (
        'ncbi_pubmed',
        'PubMed / MEDLINE (National Library of Medicine)',
        'https://pubmed.ncbi.nlm.nih.gov/',
        'Peer-reviewed biomedical literature citations and author abstracts.',
        'Public Domain Metadata (NLM)',
        'https://www.nlm.nih.gov/databases/download/terms_and_conditions.html',
        TRUE
    ),
    (
        'omim',
        'Online Mendelian Inheritance in Man (OMIM)',
        'https://omim.org/',
        'Authoritative compendium of human genes and genetic phenotypes.',
        'Copyright Johns Hopkins University (Academic/Research Use)',
        'https://omim.org/help/agreement',
        TRUE
    ),
    (
        'clingen',
        'Clinical Genome Resource (ClinGen)',
        'https://clinicalgenome.org/',
        'NIH-funded resource defining the clinical relevance of genes and variants for precision medicine.',
        'Creative Commons CC-BY 4.0',
        'https://clinicalgenome.org/about/terms-of-use/',
        TRUE
    ),
    (
        'hgnc',
        'HUGO Gene Nomenclature Committee (HGNC)',
        'https://www.genenames.org/',
        'Authoritative resource for approved human gene nomenclature.',
        'Open Access / CC-BY 4.0',
        'https://www.genenames.org/about/terms-and-conditions/',
        TRUE
    )
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    base_url = EXCLUDED.base_url,
    description = EXCLUDED.description,
    license_type = EXCLUDED.license_type,
    terms_url = EXCLUDED.terms_url,
    is_active = EXCLUDED.is_active;
