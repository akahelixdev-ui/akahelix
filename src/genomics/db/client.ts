import { neon } from "@neondatabase/serverless";

function getSql() {
  const url = process.env["DATABASE_URL"];
  if (!url) {
    throw new Error("DATABASE_URL is not configured.");
  }
  return neon(url);
}

// ============================================================================
// Public Search & Retrieval
// ============================================================================

export async function getGenomicsOverviewStats() {
  const sql = getSql();
  const [diseasesCount] = await sql`
    SELECT count(*)::int as count 
    FROM genomics.diseases 
    WHERE is_published = true AND (is_quarantined IS FALSE OR is_quarantined IS NULL) AND review_status != 'quarantined'
  `;
  const [genesCount] = await sql`
    SELECT count(*)::int as count 
    FROM genomics.genes 
    WHERE is_published = true AND (is_quarantined IS FALSE OR is_quarantined IS NULL) AND review_status != 'quarantined'
  `;
  const [variantsCount] = await sql`
    SELECT count(*)::int as count 
    FROM genomics.variants 
    WHERE is_published = true AND (is_quarantined IS FALSE OR is_quarantined IS NULL) AND review_status != 'quarantined'
  `;
  const [assertionsCount] = await sql`
    SELECT count(*)::int as count 
    FROM genomics.variant_clinical_assertions a
    JOIN genomics.variants v ON v.id = a.variant_id
    WHERE v.is_published = true AND (v.is_quarantined IS FALSE OR v.is_quarantined IS NULL) AND v.review_status != 'quarantined'
  `;
  const [publicationsCount] = await sql`SELECT count(*)::int as count FROM genomics.publications`;
  const [sourcesCount] = await sql`SELECT count(*)::int as count FROM genomics.data_sources WHERE is_active = true`;

  const recentReviews = await sql`
    SELECT * FROM genomics.scientific_reviews
    ORDER BY created_at DESC
    LIMIT 5
  `;

  return {
    diseasesCount: Number((diseasesCount as any)?.count || 0),
    genesCount: Number((genesCount as any)?.count || 0),
    variantsCount: Number((variantsCount as any)?.count || 0),
    assertionsCount: Number((assertionsCount as any)?.count || 0),
    publicationsCount: Number((publicationsCount as any)?.count || 0),
    sourcesCount: Number((sourcesCount as any)?.count || 0),
    recentReviews: recentReviews as any[],
  };
}

// ----------------------------------------------------------------------------
// Diseases
// ----------------------------------------------------------------------------
export async function getDiseases(options: {
  page?: number | undefined;
  limit?: number | undefined;
  search?: string | undefined;
  inheritance?: string | undefined;
} = {}) {
  const sql = getSql();
  const page = Math.max(1, options.page || 1);
  const limit = Math.min(100, Math.max(1, options.limit || 20));
  const offset = (page - 1) * limit;

  let baseQuery = sql`
    SELECT d.*,
      (SELECT json_agg(json_build_object('id', g.id, 'symbol', g.symbol, 'name', g.name))
       FROM genomics.disease_gene_relationships dgr
       JOIN genomics.genes g ON g.id = dgr.gene_id
       WHERE dgr.disease_id = d.id AND g.is_published = true AND (g.is_quarantined IS FALSE OR g.is_quarantined IS NULL) AND g.review_status != 'quarantined') as genes,
      (SELECT count(*)::int
       FROM genomics.variant_disease_relationships vdr
       JOIN genomics.variants v ON v.id = vdr.variant_id
       WHERE vdr.disease_id = d.id AND v.is_published = true AND (v.is_quarantined IS FALSE OR v.is_quarantined IS NULL) AND v.review_status != 'quarantined') as variant_count
    FROM genomics.diseases d
    WHERE d.is_published = true AND (d.is_quarantined IS FALSE OR d.is_quarantined IS NULL) AND d.review_status != 'quarantined'
  `;

  if (options.search) {
    const s = `%${options.search}%`;
    baseQuery = sql`
      ${baseQuery}
      AND (d.name ILIKE ${s} OR d.slug ILIKE ${s} OR d.concept_id ILIKE ${s} OR d.omim_id ILIKE ${s})
    `;
  }

  if (options.inheritance) {
    baseQuery = sql`
      ${baseQuery}
      AND d.inheritance_mode ILIKE ${'%' + options.inheritance + '%'}
    `;
  }

  const rows = await sql`
    ${baseQuery}
    ORDER BY d.name ASC
    LIMIT ${limit} OFFSET ${offset}
  `;

  const [totalRow] = await sql`
    SELECT count(*)::int as total
    FROM genomics.diseases d
    WHERE d.is_published = true AND (d.is_quarantined IS FALSE OR d.is_quarantined IS NULL) AND d.review_status != 'quarantined'
    ${options.search ? sql`AND (d.name ILIKE ${'%' + options.search + '%'} OR d.slug ILIKE ${'%' + options.search + '%'})` : sql``}
    ${options.inheritance ? sql`AND d.inheritance_mode ILIKE ${'%' + options.inheritance + '%'}` : sql``}
  `;

  const total = Number((totalRow as any)?.total || 0);

  return {
    items: rows as any[],
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

export async function getDiseaseByIdOrSlug(idOrSlug: string) {
  const sql = getSql();
  const [disease] = await sql`
    SELECT d.*
    FROM genomics.diseases d
    WHERE (d.id::text = ${idOrSlug} OR d.slug = ${idOrSlug})
      AND d.is_published = true
      AND (d.is_quarantined IS FALSE OR d.is_quarantined IS NULL)
      AND d.review_status != 'quarantined'
    LIMIT 1
  `;
  if (!disease) return null;

  const diseaseId = (disease as any).id;

  const genes = await sql`
    SELECT g.*, dgr.relationship_type, dgr.evidence_level, dgr.inheritance_pattern, dgr.curator_notes
    FROM genomics.disease_gene_relationships dgr
    JOIN genomics.genes g ON g.id = dgr.gene_id
    WHERE dgr.disease_id = ${diseaseId}
      AND g.is_published = true
      AND (g.is_quarantined IS FALSE OR g.is_quarantined IS NULL)
      AND g.review_status != 'quarantined'
    ORDER BY g.symbol ASC
  `;

  const variants = await sql`
    SELECT v.*, vdr.clinical_significance, vdr.review_status_clinvar, vdr.gold_stars
    FROM genomics.variant_disease_relationships vdr
    JOIN genomics.variants v ON v.id = vdr.variant_id
    WHERE vdr.disease_id = ${diseaseId}
      AND v.is_published = true
      AND (v.is_quarantined IS FALSE OR v.is_quarantined IS NULL)
      AND v.review_status != 'quarantined'
    ORDER BY vdr.gold_stars DESC, v.preferred_name ASC
  `;

  const phenotypes = await sql`
    SELECT p.*, dpr.frequency
    FROM genomics.disease_phenotype_relationships dpr
    JOIN genomics.phenotypes p ON p.id = dpr.phenotype_id
    WHERE dpr.disease_id = ${diseaseId}
    ORDER BY p.term ASC
  `;

  const publications = await sql`
    SELECT pub.*, ref.evidence_note
    FROM genomics.scientific_references ref
    JOIN genomics.publications pub ON pub.id = ref.publication_id
    WHERE ref.entity_type = 'disease' AND ref.entity_id = ${diseaseId}
    ORDER BY pub.pub_year DESC NULLS LAST
  `;

  return {
    ...(disease as any),
    genes: genes as any[],
    variants: variants as any[],
    phenotypes: phenotypes as any[],
    publications: publications as any[],
  };
}

// ----------------------------------------------------------------------------
// Genes
// ----------------------------------------------------------------------------
export async function getGenes(options: {
  page?: number | undefined;
  limit?: number | undefined;
  search?: string | undefined;
  chromosome?: string | undefined;
} = {}) {
  const sql = getSql();
  const page = Math.max(1, options.page || 1);
  const limit = Math.min(100, Math.max(1, options.limit || 20));
  const offset = (page - 1) * limit;

  let baseQuery = sql`
    SELECT g.*,
      (SELECT json_agg(json_build_object('id', d.id, 'name', d.name, 'slug', d.slug))
       FROM genomics.disease_gene_relationships dgr
       JOIN genomics.diseases d ON d.id = dgr.disease_id
       WHERE dgr.gene_id = g.id AND d.is_published = true AND (d.is_quarantined IS FALSE OR d.is_quarantined IS NULL) AND d.review_status != 'quarantined') as diseases,
      (SELECT count(*)::int
       FROM genomics.variant_gene_relationships vgr
       JOIN genomics.variants v ON v.id = vgr.variant_id
       WHERE vgr.gene_id = g.id AND v.is_published = true AND (v.is_quarantined IS FALSE OR v.is_quarantined IS NULL) AND v.review_status != 'quarantined') as variant_count
    FROM genomics.genes g
    WHERE g.is_published = true AND (g.is_quarantined IS FALSE OR g.is_quarantined IS NULL) AND g.review_status != 'quarantined'
  `;

  if (options.search) {
    const s = `%${options.search}%`;
    baseQuery = sql`
      ${baseQuery}
      AND (g.symbol ILIKE ${s} OR g.name ILIKE ${s} OR g.entrez_gene_id ILIKE ${s} OR g.hgnc_id ILIKE ${s})
    `;
  }

  if (options.chromosome) {
    baseQuery = sql`
      ${baseQuery}
      AND g.chromosome = ${options.chromosome}
    `;
  }

  const rows = await sql`
    ${baseQuery}
    ORDER BY g.symbol ASC
    LIMIT ${limit} OFFSET ${offset}
  `;

  const [totalRow] = await sql`
    SELECT count(*)::int as total
    FROM genomics.genes g
    WHERE g.is_published = true AND (g.is_quarantined IS FALSE OR g.is_quarantined IS NULL) AND g.review_status != 'quarantined'
    ${options.search ? sql`AND (g.symbol ILIKE ${'%' + options.search + '%'} OR g.name ILIKE ${'%' + options.search + '%'})` : sql``}
    ${options.chromosome ? sql`AND g.chromosome = ${options.chromosome}` : sql``}
  `;

  const total = Number((totalRow as any)?.total || 0);

  return {
    items: rows as any[],
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

export async function getGeneByIdOrSymbol(idOrSymbol: string) {
  const sql = getSql();
  const [gene] = await sql`
    SELECT g.*
    FROM genomics.genes g
    WHERE (g.id::text = ${idOrSymbol} OR UPPER(g.symbol) = UPPER(${idOrSymbol}))
      AND g.is_published = true
      AND (g.is_quarantined IS FALSE OR g.is_quarantined IS NULL)
      AND g.review_status != 'quarantined'
    LIMIT 1
  `;
  if (!gene) return null;

  const geneId = (gene as any).id;

  const diseases = await sql`
    SELECT d.*, dgr.relationship_type, dgr.evidence_level, dgr.inheritance_pattern
    FROM genomics.disease_gene_relationships dgr
    JOIN genomics.diseases d ON d.id = dgr.disease_id
    WHERE dgr.gene_id = ${geneId}
      AND d.is_published = true
      AND (d.is_quarantined IS FALSE OR d.is_quarantined IS NULL)
      AND d.review_status != 'quarantined'
    ORDER BY d.name ASC
  `;

  const variants = await sql`
    SELECT v.*, vgr.consequence, vgr.exon_number,
      (SELECT json_agg(json_build_object('significance', vdr.clinical_significance, 'stars', vdr.gold_stars))
       FROM genomics.variant_disease_relationships vdr
       WHERE vdr.variant_id = v.id) as disease_links
    FROM genomics.variant_gene_relationships vgr
    JOIN genomics.variants v ON v.id = vgr.variant_id
    WHERE vgr.gene_id = ${geneId}
      AND v.is_published = true
      AND (v.is_quarantined IS FALSE OR v.is_quarantined IS NULL)
      AND v.review_status != 'quarantined'
    ORDER BY v.position_vcf ASC NULLS LAST, v.preferred_name ASC
  `;

  const publications = await sql`
    SELECT pub.*, ref.evidence_note
    FROM genomics.scientific_references ref
    JOIN genomics.publications pub ON pub.id = ref.publication_id
    WHERE ref.entity_type = 'gene' AND ref.entity_id = ${geneId}
    ORDER BY pub.pub_year DESC NULLS LAST
  `;

  return {
    ...(gene as any),
    diseases: diseases as any[],
    variants: variants as any[],
    publications: publications as any[],
  };
}

// ----------------------------------------------------------------------------
// Variants
// ----------------------------------------------------------------------------
export async function getVariants(options: {
  page?: number | undefined;
  limit?: number | undefined;
  search?: string | undefined;
  significance?: string | undefined;
  chromosome?: string | undefined;
  geneSymbol?: string | undefined;
} = {}) {
  const sql = getSql();
  const page = Math.max(1, options.page || 1);
  const limit = Math.min(100, Math.max(1, options.limit || 20));
  const offset = (page - 1) * limit;

  let baseQuery = sql`
    SELECT v.*,
      (SELECT g.symbol
       FROM genomics.variant_gene_relationships vgr
       JOIN genomics.genes g ON g.id = vgr.gene_id
       WHERE vgr.variant_id = v.id
       LIMIT 1) as gene_symbol
    FROM genomics.variants v
    WHERE v.is_published = true AND (v.is_quarantined IS FALSE OR v.is_quarantined IS NULL) AND v.review_status != 'quarantined'
  `;

  if (options.search) {
    const s = `%${options.search}%`;
    baseQuery = sql`
      ${baseQuery}
      AND (v.preferred_name ILIKE ${s} OR v.clinvar_vcv ILIKE ${s} OR v.dbsnp_id ILIKE ${s} OR v.hgvs_cdna ILIKE ${s} OR v.hgvs_protein ILIKE ${s})
    `;
  }

  if (options.significance) {
    baseQuery = sql`
      ${baseQuery}
      AND v.clinical_significance ILIKE ${'%' + options.significance + '%'}
    `;
  }

  if (options.chromosome) {
    baseQuery = sql`
      ${baseQuery}
      AND v.chromosome = ${options.chromosome}
    `;
  }

  const rows = await sql`
    ${baseQuery}
    ORDER BY v.gold_stars DESC, v.preferred_name ASC
    LIMIT ${limit} OFFSET ${offset}
  `;

  const [totalRow] = await sql`
    SELECT count(*)::int as total
    FROM genomics.variants v
    WHERE v.is_published = true AND (v.is_quarantined IS FALSE OR v.is_quarantined IS NULL) AND v.review_status != 'quarantined'
    ${options.search ? sql`AND (v.preferred_name ILIKE ${'%' + options.search + '%'} OR v.clinvar_vcv ILIKE ${'%' + options.search + '%'} OR v.dbsnp_id ILIKE ${'%' + options.search + '%'})` : sql``}
    ${options.significance ? sql`AND v.clinical_significance ILIKE ${'%' + options.significance + '%'}` : sql``}
    ${options.chromosome ? sql`AND v.chromosome = ${options.chromosome}` : sql``}
  `;

  const total = Number((totalRow as any)?.total || 0);

  return {
    items: rows as any[],
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

export async function getVariantByIdOrVcv(idOrVcv: string) {
  const sql = getSql();
  const [variant] = await sql`
    SELECT v.*
    FROM genomics.variants v
    WHERE (v.id::text = ${idOrVcv} OR v.clinvar_vcv = ${idOrVcv} OR v.dbsnp_id = ${idOrVcv})
      AND v.is_published = true
      AND (v.is_quarantined IS FALSE OR v.is_quarantined IS NULL)
      AND v.review_status != 'quarantined'
    LIMIT 1
  `;
  if (!variant) return null;

  const variantId = (variant as any).id;

  const genes = await sql`
    SELECT g.*, vgr.consequence, vgr.exon_number, vgr.intron_number
    FROM genomics.variant_gene_relationships vgr
    JOIN genomics.genes g ON g.id = vgr.gene_id
    WHERE vgr.variant_id = ${variantId}
      AND g.is_published = true
      AND (g.is_quarantined IS FALSE OR g.is_quarantined IS NULL)
      AND g.review_status != 'quarantined'
  `;

  const diseases = await sql`
    SELECT d.*, vdr.clinical_significance, vdr.review_status_clinvar, vdr.gold_stars, vdr.source_evidence
    FROM genomics.variant_disease_relationships vdr
    JOIN genomics.diseases d ON d.id = vdr.disease_id
    WHERE vdr.variant_id = ${variantId}
      AND d.is_published = true
      AND (d.is_quarantined IS FALSE OR d.is_quarantined IS NULL)
      AND d.review_status != 'quarantined'
  `;

  const assertions = await sql`
    SELECT *
    FROM genomics.variant_clinical_assertions
    WHERE variant_id = ${variantId}
    ORDER BY submission_date DESC NULLS LAST
  `;

  const publications = await sql`
    SELECT pub.*, ref.evidence_note
    FROM genomics.scientific_references ref
    JOIN genomics.publications pub ON pub.id = ref.publication_id
    WHERE ref.entity_type = 'variant' AND ref.entity_id = ${variantId}
    ORDER BY pub.pub_year DESC NULLS LAST
  `;

  return {
    ...(variant as any),
    genes: genes as any[],
    diseases: diseases as any[],
    assertions: assertions as any[],
    publications: publications as any[],
  };
}

// ----------------------------------------------------------------------------
// Unified Multi-Entity Search (Phase 06 Advanced Search & Facets)
// ----------------------------------------------------------------------------
export type SearchCategory = "all" | "diseases" | "genes" | "variants" | "phenotypes" | "publications";

export async function searchGenomics(
  query: string,
  options: {
    category?: SearchCategory | undefined;
    significance?: string | undefined;
    chromosome?: string | undefined;
    inheritance?: string | undefined;
    evidenceLevel?: string | undefined;
    reviewStatus?: string | undefined;
    limit?: number | undefined;
  } = {}
) {
  const sql = getSql();
  const trimmed = query.trim();
  const hasQuery = trimmed.length > 0;
  const q = `%${trimmed}%`;
  const limit = Math.min(100, options.limit || 25);
  const category = options.category || "all";

  // Never allow quarantined records to be queried via reviewStatus
  const safeReviewStatus =
    options.reviewStatus && options.reviewStatus !== "quarantined"
      ? options.reviewStatus
      : undefined;

  const shouldFetchDiseases = category === "all" || category === "diseases";
  const shouldFetchGenes = category === "all" || category === "genes";
  const shouldFetchVariants = category === "all" || category === "variants";
  const shouldFetchPhenotypes = category === "all" || category === "phenotypes";
  const shouldFetchPublications = category === "all" || category === "publications";

  let diseases: any[] = [];
  if (shouldFetchDiseases && !options.significance) {
    diseases = await sql`
      SELECT d.id, d.slug, d.name, d.concept_id, d.omim_id, d.orpha_code, d.mondo_id,
             d.inheritance_mode, d.definition, d.review_status, 'disease' as entity_type
      FROM genomics.diseases d
      WHERE d.is_published = true
        AND (d.is_quarantined IS FALSE OR d.is_quarantined IS NULL)
        AND d.review_status != 'quarantined'
        ${hasQuery ? sql`AND (
          d.name ILIKE ${q}
          OR d.slug ILIKE ${q}
          OR d.concept_id ILIKE ${q}
          OR d.omim_id ILIKE ${q}
          OR d.orpha_code ILIKE ${q}
          OR d.mondo_id ILIKE ${q}
          OR d.definition ILIKE ${q}
        )` : sql``}
        ${options.inheritance ? sql`AND d.inheritance_mode ILIKE ${'%' + options.inheritance + '%'}` : sql``}
        ${safeReviewStatus ? sql`AND d.review_status = ${safeReviewStatus}` : sql``}
        ${options.chromosome ? sql`AND EXISTS (
          SELECT 1 FROM genomics.disease_gene_relationships dgr
          JOIN genomics.genes g ON g.id = dgr.gene_id
          WHERE dgr.disease_id = d.id AND g.chromosome = ${options.chromosome}
            AND g.is_published = true AND (g.is_quarantined IS FALSE OR g.is_quarantined IS NULL)
        )` : sql``}
        ${options.evidenceLevel ? sql`AND EXISTS (
          SELECT 1 FROM genomics.disease_gene_relationships dgr
          WHERE dgr.disease_id = d.id AND dgr.evidence_level ILIKE ${'%' + options.evidenceLevel + '%'}
        )` : sql``}
      ORDER BY d.name ASC
      LIMIT ${limit}
    `;
  }

  let genes: any[] = [];
  if (shouldFetchGenes && !options.significance) {
    genes = await sql`
      SELECT g.id, g.symbol, g.name, g.chromosome, g.cytogenetic_location as cytoband,
             g.entrez_gene_id, g.hgnc_id, g.ensembl_gene_id, g.review_status, 'gene' as entity_type
      FROM genomics.genes g
      WHERE g.is_published = true
        AND (g.is_quarantined IS FALSE OR g.is_quarantined IS NULL)
        AND g.review_status != 'quarantined'
        ${hasQuery ? sql`AND (
          g.symbol ILIKE ${q}
          OR g.name ILIKE ${q}
          OR g.entrez_gene_id ILIKE ${q}
          OR g.hgnc_id ILIKE ${q}
          OR g.ensembl_gene_id ILIKE ${q}
          OR g.cytogenetic_location ILIKE ${q}
        )` : sql``}
        ${options.chromosome ? sql`AND g.chromosome = ${options.chromosome}` : sql``}
        ${safeReviewStatus ? sql`AND g.review_status = ${safeReviewStatus}` : sql``}
        ${options.inheritance ? sql`AND EXISTS (
          SELECT 1 FROM genomics.disease_gene_relationships dgr
          JOIN genomics.diseases d ON d.id = dgr.disease_id
          WHERE dgr.gene_id = g.id AND d.inheritance_mode ILIKE ${'%' + options.inheritance + '%'}
            AND d.is_published = true AND (d.is_quarantined IS FALSE OR d.is_quarantined IS NULL)
        )` : sql``}
        ${options.evidenceLevel ? sql`AND EXISTS (
          SELECT 1 FROM genomics.disease_gene_relationships dgr
          WHERE dgr.gene_id = g.id AND dgr.evidence_level ILIKE ${'%' + options.evidenceLevel + '%'}
        )` : sql``}
      ORDER BY g.symbol ASC
      LIMIT ${limit}
    `;
  }

  let variants: any[] = [];
  if (shouldFetchVariants) {
    variants = await sql`
      SELECT v.id, v.preferred_name, v.clinvar_vcv, v.dbsnp_id, v.hgvs_cdna, v.hgvs_protein,
             v.hgvs_genomic, v.chromosome, v.position_vcf, v.clinical_significance,
             v.review_status_clinvar, v.review_status, v.gold_stars, v.molecular_consequence,
             'variant' as entity_type
      FROM genomics.variants v
      WHERE v.is_published = true
        AND (v.is_quarantined IS FALSE OR v.is_quarantined IS NULL)
        AND v.review_status != 'quarantined'
        ${hasQuery ? sql`AND (
          v.preferred_name ILIKE ${q}
          OR v.clinvar_vcv ILIKE ${q}
          OR v.dbsnp_id ILIKE ${q}
          OR v.hgvs_cdna ILIKE ${q}
          OR v.hgvs_protein ILIKE ${q}
          OR v.hgvs_genomic ILIKE ${q}
          OR v.molecular_consequence ILIKE ${q}
        )` : sql``}
        ${options.significance ? sql`AND v.clinical_significance ILIKE ${'%' + options.significance + '%'}` : sql``}
        ${options.chromosome ? sql`AND v.chromosome = ${options.chromosome}` : sql``}
        ${safeReviewStatus ? sql`AND v.review_status = ${safeReviewStatus}` : sql``}
        ${options.inheritance ? sql`AND EXISTS (
          SELECT 1 FROM genomics.variant_disease_relationships vdr
          JOIN genomics.diseases d ON d.id = vdr.disease_id
          WHERE vdr.variant_id = v.id AND d.inheritance_mode ILIKE ${'%' + options.inheritance + '%'}
            AND d.is_published = true AND (d.is_quarantined IS FALSE OR d.is_quarantined IS NULL)
        )` : sql``}
        ${options.evidenceLevel ? sql`AND (
          (LOWER(${options.evidenceLevel}) = 'definitive' AND v.gold_stars >= 3)
          OR (LOWER(${options.evidenceLevel}) = 'strong' AND v.gold_stars >= 2)
          OR (LOWER(${options.evidenceLevel}) = 'moderate' AND v.gold_stars >= 1)
          OR EXISTS (
            SELECT 1 FROM genomics.variant_disease_relationships vdr
            JOIN genomics.disease_gene_relationships dgr ON dgr.disease_id = vdr.disease_id
            WHERE vdr.variant_id = v.id AND dgr.evidence_level ILIKE ${'%' + options.evidenceLevel + '%'}
          )
        )` : sql``}
      ORDER BY v.gold_stars DESC, v.preferred_name ASC
      LIMIT ${limit}
    `;
  }

  let phenotypes: any[] = [];
  if (shouldFetchPhenotypes && !options.chromosome && !options.significance && !safeReviewStatus) {
    phenotypes = await sql`
      SELECT p.id, p.hpo_id, p.term, p.definition, 'phenotype' as entity_type,
             (SELECT json_agg(json_build_object('slug', d2.slug, 'name', d2.name))
              FROM genomics.disease_phenotype_relationships dpr2
              JOIN genomics.diseases d2 ON d2.id = dpr2.disease_id
              WHERE dpr2.phenotype_id = p.id
                AND d2.is_published = true AND (d2.is_quarantined IS FALSE OR d2.is_quarantined IS NULL)) as diseases
      FROM genomics.phenotypes p
      WHERE EXISTS (
        SELECT 1
        FROM genomics.disease_phenotype_relationships dpr
        JOIN genomics.diseases d ON d.id = dpr.disease_id
        WHERE dpr.phenotype_id = p.id
          AND d.is_published = true
          AND (d.is_quarantined IS FALSE OR d.is_quarantined IS NULL)
          AND d.review_status != 'quarantined'
          ${options.inheritance ? sql`AND d.inheritance_mode ILIKE ${'%' + options.inheritance + '%'}` : sql``}
      )
      ${hasQuery ? sql`AND (p.hpo_id ILIKE ${q} OR p.term ILIKE ${q} OR p.definition ILIKE ${q})` : sql``}
      ORDER BY p.term ASC
      LIMIT ${limit}
    `;
  }

  let publications: any[] = [];
  if (shouldFetchPublications && !options.chromosome && !options.significance && !options.inheritance && !safeReviewStatus && !options.evidenceLevel) {
    publications = await sql`
      SELECT id, pmid, pmcid, doi, title, authors, journal, pub_year, pub_date,
             'publication' as entity_type
      FROM genomics.publications
      WHERE 1=1
        ${hasQuery ? sql`AND (
          pmid ILIKE ${q}
          OR pmcid ILIKE ${q}
          OR doi ILIKE ${q}
          OR title ILIKE ${q}
          OR authors::text ILIKE ${q}
          OR journal ILIKE ${q}
          OR abstract ILIKE ${q}
        )` : sql``}
      ORDER BY pub_year DESC NULLS LAST, title ASC
      LIMIT ${limit}
    `;
  }

  // Real facet options from published non-quarantined DB records
  const [chromRows, inhRows, sigRows, evRows] = await Promise.all([
    sql`
      SELECT DISTINCT chromosome FROM (
        SELECT chromosome FROM genomics.genes WHERE is_published = true AND (is_quarantined IS FALSE OR is_quarantined IS NULL) AND chromosome IS NOT NULL
        UNION
        SELECT chromosome FROM genomics.variants WHERE is_published = true AND (is_quarantined IS FALSE OR is_quarantined IS NULL) AND chromosome IS NOT NULL
      ) c ORDER BY chromosome ASC
    `,
    sql`SELECT DISTINCT inheritance_mode FROM genomics.diseases WHERE is_published = true AND (is_quarantined IS FALSE OR is_quarantined IS NULL) AND inheritance_mode IS NOT NULL ORDER BY inheritance_mode ASC`,
    sql`SELECT DISTINCT clinical_significance FROM genomics.variants WHERE is_published = true AND (is_quarantined IS FALSE OR is_quarantined IS NULL) AND clinical_significance IS NOT NULL ORDER BY clinical_significance ASC`,
    sql`SELECT DISTINCT evidence_level FROM genomics.disease_gene_relationships WHERE evidence_level IS NOT NULL ORDER BY evidence_level ASC`,
  ]);

  return {
    query,
    category,
    diseases,
    genes,
    variants,
    phenotypes,
    publications,
    facets: {
      chromosomes: chromRows.map((r: any) => r.chromosome),
      inheritances: inhRows.map((r: any) => r.inheritance_mode),
      significances: sigRows.map((r: any) => r.clinical_significance),
      evidenceLevels: evRows.map((r: any) => r.evidence_level),
      reviewStatuses: ["approved", "pending_review"],
    },
    total: diseases.length + genes.length + variants.length + phenotypes.length + publications.length,
  };
}

// ----------------------------------------------------------------------------
// Research Publications
// ----------------------------------------------------------------------------
export async function getResearchPublications(options: {
  page?: number | undefined;
  limit?: number | undefined;
  search?: string | undefined;
} = {}) {
  const sql = getSql();
  const page = Math.max(1, options.page || 1);
  const limit = Math.min(100, Math.max(1, options.limit || 20));
  const offset = (page - 1) * limit;

  let baseQuery = sql`
    SELECT p.*,
      (SELECT json_agg(json_build_object('type', ref.entity_type, 'id', ref.entity_id))
       FROM genomics.scientific_references ref
       WHERE ref.publication_id = p.id) as referenced_entities
    FROM genomics.publications p
  `;

  if (options.search) {
    const s = `%${options.search}%`;
    baseQuery = sql`
      ${baseQuery}
      WHERE p.title ILIKE ${s} OR p.pmid ILIKE ${s} OR p.journal ILIKE ${s}
    `;
  }

  const rows = await sql`
    ${baseQuery}
    ORDER BY p.pub_year DESC NULLS LAST, p.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  const [totalRow] = await sql`
    SELECT count(*)::int as total
    FROM genomics.publications p
    ${options.search ? sql`WHERE p.title ILIKE ${'%' + options.search + '%'} OR p.pmid ILIKE ${'%' + options.search + '%'}` : sql``}
  `;

  const total = Number((totalRow as any)?.total || 0);

  return {
    items: rows as any[],
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

// ============================================================================
// Server-Side Admin & Curation Actions
// ============================================================================

export class ReviewValidationError extends Error {
  status: number;
  code: string;
  constructor(message: string, status: number = 400, code: string = "REVIEW_VALIDATION_ERROR") {
    super(message);
    this.name = "ReviewValidationError";
    this.status = status;
    this.code = code;
  }
}

const VALID_REVIEW_DECISIONS = ["accepted", "flagged", "rejected", "modified"] as const;
const VALID_ENTITY_TYPES = ["disease", "gene", "variant", "clinical_assertion"] as const;

async function resolveEntityForReview(
  sql: ReturnType<typeof getSql>,
  entityType: "disease" | "gene" | "variant" | "clinical_assertion",
  rawIdentifier: string
): Promise<{ id: string; previousStatus: string | null; label: string }> {
  const id = rawIdentifier.trim();
  if (!id) {
    throw new ReviewValidationError("Entity identifier or accession is required.", 400, "MISSING_ENTITY_ID");
  }

  if (entityType === "variant") {
    const [row] = await sql`
      SELECT id::text AS id, review_status, clinvar_vcv AS label
      FROM genomics.variants
      WHERE id::text = ${id} OR UPPER(clinvar_vcv) = UPPER(${id}) OR UPPER(dbsnp_id) = UPPER(${id})
      LIMIT 1
    `;
    if (!row) {
      throw new ReviewValidationError(
        `No variant record found matching "${id}". Enter a valid UUID, ClinVar VCV (e.g. VCV000015408), or dbSNP rsID.`,
        404,
        "ENTITY_NOT_FOUND"
      );
    }
    return { id: (row as any).id, previousStatus: (row as any).review_status || null, label: (row as any).label || id };
  }

  if (entityType === "gene") {
    const [row] = await sql`
      SELECT id::text AS id, review_status, symbol AS label
      FROM genomics.genes
      WHERE id::text = ${id} OR UPPER(symbol) = UPPER(${id}) OR entrez_gene_id = ${id} OR UPPER(hgnc_id) = UPPER(${id})
      LIMIT 1
    `;
    if (!row) {
      throw new ReviewValidationError(
        `No gene record found matching "${id}". Enter a valid UUID, HGNC symbol (e.g. HBB), Entrez ID, or HGNC ID.`,
        404,
        "ENTITY_NOT_FOUND"
      );
    }
    return { id: (row as any).id, previousStatus: (row as any).review_status || null, label: (row as any).label || id };
  }

  if (entityType === "disease") {
    const [row] = await sql`
      SELECT id::text AS id, review_status, name AS label
      FROM genomics.diseases
      WHERE id::text = ${id} OR LOWER(slug) = LOWER(${id}) OR UPPER(concept_id) = UPPER(${id}) OR omim_id = ${id}
      LIMIT 1
    `;
    if (!row) {
      throw new ReviewValidationError(
        `No disease record found matching "${id}". Enter a valid UUID, disease slug (e.g. beta-thalassemia), MedGen ID, or OMIM ID.`,
        404,
        "ENTITY_NOT_FOUND"
      );
    }
    return { id: (row as any).id, previousStatus: (row as any).review_status || null, label: (row as any).label || id };
  }

  if (entityType === "clinical_assertion") {
    const [row] = await sql`
      SELECT id::text AS id, clinical_significance AS review_status, COALESCE(rcv_accession, scv_accession, id::text) AS label
      FROM genomics.variant_clinical_assertions
      WHERE id::text = ${id} OR UPPER(rcv_accession) = UPPER(${id}) OR UPPER(scv_accession) = UPPER(${id})
      LIMIT 1
    `;
    if (!row) {
      throw new ReviewValidationError(
        `No clinical assertion record found matching "${id}". Enter a valid UUID, RCV accession, or SCV accession.`,
        404,
        "ENTITY_NOT_FOUND"
      );
    }
    return { id: (row as any).id, previousStatus: (row as any).review_status || null, label: (row as any).label || id };
  }

  throw new ReviewValidationError(`Unsupported entityType: ${entityType}`, 400, "INVALID_ENTITY_TYPE");
}

export async function createScientificReview(data: {
  entityType: "disease" | "gene" | "variant" | "clinical_assertion";
  entityId: string;
  reviewerEmail: string;
  reviewerName?: string | undefined;
  reviewDecision: "accepted" | "flagged" | "rejected" | "modified";
  curatorNotes: string;
  proposedChanges?: any;
}) {
  if (!VALID_ENTITY_TYPES.includes(data.entityType)) {
    throw new ReviewValidationError(`Invalid entity type "${data.entityType}".`, 400, "INVALID_ENTITY_TYPE");
  }
  if (!VALID_REVIEW_DECISIONS.includes(data.reviewDecision)) {
    throw new ReviewValidationError(
      "Explicit review decision is required (accepted, flagged, modified, or rejected).",
      400,
      "INVALID_REVIEW_DECISION"
    );
  }
  if (!data.curatorNotes || data.curatorNotes.trim().length === 0) {
    throw new ReviewValidationError("Curator notes and evidence rationale are required.", 400, "MISSING_NOTES");
  }

  const sql = getSql();
  const reviewerName = data.reviewerName || data.reviewerEmail.split("@")[0] || "Curator";
  const resolved = await resolveEntityForReview(sql, data.entityType, data.entityId);

  const newStatus =
    data.reviewDecision === "accepted"
      ? "approved"
      : data.reviewDecision === "modified"
        ? "needs_revision"
        : data.reviewDecision;

  const auditDetails = JSON.stringify({
    notes: data.curatorNotes.trim(),
    decision: data.reviewDecision,
    submittedIdentifier: data.entityId.trim(),
    resolvedLabel: resolved.label,
    previousStatus: resolved.previousStatus,
    newStatus,
    proposedChanges: data.proposedChanges ?? null,
  });

  // Execute review insert, entity status update, and audit log atomically
  const txQueries: any[] = [
    sql`
      INSERT INTO genomics.scientific_reviews (
        entity_type, entity_id, reviewer_email, reviewer_name, action, notes, previous_status, new_status
      )
      VALUES (
        ${data.entityType}, ${resolved.id}::uuid, ${data.reviewerEmail},
        ${reviewerName}, ${data.reviewDecision}, ${data.curatorNotes.trim()},
        ${resolved.previousStatus}, ${newStatus}
      )
      RETURNING *
    `,
    sql`
      INSERT INTO genomics.audit_logs (
        actor_email, action, entity_type, entity_id, details
      )
      VALUES (
        ${data.reviewerEmail}, ${'REVIEW_' + data.reviewDecision.toUpperCase()},
        ${data.entityType}, ${resolved.id},
        ${auditDetails}::jsonb
      )
    `,
  ];

  if (data.entityType === "variant") {
    txQueries.push(sql`
      UPDATE genomics.variants
      SET review_status = ${newStatus}, updated_at = NOW()
      WHERE id = ${resolved.id}::uuid
    `);
  } else if (data.entityType === "gene") {
    txQueries.push(sql`
      UPDATE genomics.genes
      SET review_status = ${newStatus}, updated_at = NOW()
      WHERE id = ${resolved.id}::uuid
    `);
  } else if (data.entityType === "disease") {
    txQueries.push(sql`
      UPDATE genomics.diseases
      SET review_status = ${newStatus}, updated_at = NOW()
      WHERE id = ${resolved.id}::uuid
    `);
  }

  const txResults = await sql.transaction(txQueries);
  const review = (txResults[0] as any[])[0];

  return {
    ...review,
    resolved_entity_id: resolved.id,
    resolved_label: resolved.label,
    review_decision: data.reviewDecision,
    curator_notes: data.curatorNotes.trim(),
  };
}

export async function getAdminGenomicsOverview() {
  const sql = getSql();
  const overview = await getGenomicsOverviewStats();

  const [
    diseases,
    genes,
    variants,
    reviews,
    sources,
    imports,
    audits,
    classifications,
    diseaseBreakdownRows,
    geneBreakdownRows,
    variantBreakdownRows,
    assertionBreakdownRows,
  ] = await Promise.all([
    sql`SELECT * FROM genomics.diseases ORDER BY name ASC LIMIT 50`,
    sql`SELECT * FROM genomics.genes ORDER BY symbol ASC LIMIT 50`,
    sql`SELECT * FROM genomics.variants ORDER BY gold_stars DESC, preferred_name ASC LIMIT 50`,
    sql`SELECT * FROM genomics.scientific_reviews ORDER BY created_at DESC LIMIT 50`,
    sql`SELECT * FROM genomics.data_sources ORDER BY id ASC`,
    sql`SELECT * FROM genomics.import_jobs ORDER BY COALESCE(created_at, started_at) DESC LIMIT 20`,
    sql`SELECT * FROM genomics.audit_logs ORDER BY created_at DESC LIMIT 50`,
    sql`
      SELECT ch.*, v.preferred_name
      FROM genomics.classification_history ch
      LEFT JOIN genomics.variants v ON v.id = ch.variant_id
      ORDER BY ch.changed_at DESC LIMIT 30
    `,
    sql`
      SELECT
        count(*)::int AS total,
        count(*) FILTER (WHERE is_published = true AND (is_quarantined IS FALSE OR is_quarantined IS NULL) AND review_status != 'quarantined')::int AS public,
        count(*) FILTER (WHERE is_quarantined IS TRUE OR review_status = 'quarantined')::int AS quarantined,
        count(*) FILTER (WHERE review_status = 'approved' AND (is_quarantined IS FALSE OR is_quarantined IS NULL))::int AS approved
      FROM genomics.diseases
    `,
    sql`
      SELECT
        count(*)::int AS total,
        count(*) FILTER (WHERE is_published = true AND (is_quarantined IS FALSE OR is_quarantined IS NULL) AND review_status != 'quarantined')::int AS public,
        count(*) FILTER (WHERE is_quarantined IS TRUE OR review_status = 'quarantined')::int AS quarantined,
        count(*) FILTER (WHERE review_status = 'approved' AND (is_quarantined IS FALSE OR is_quarantined IS NULL))::int AS approved
      FROM genomics.genes
    `,
    sql`
      SELECT
        count(*)::int AS total,
        count(*) FILTER (WHERE is_published = true AND (is_quarantined IS FALSE OR is_quarantined IS NULL) AND review_status != 'quarantined')::int AS public,
        count(*) FILTER (WHERE is_quarantined IS TRUE OR review_status = 'quarantined')::int AS quarantined,
        count(*) FILTER (WHERE review_status = 'approved' AND (is_quarantined IS FALSE OR is_quarantined IS NULL))::int AS approved
      FROM genomics.variants
    `,
    sql`
      SELECT
        count(*)::int AS total,
        count(*) FILTER (WHERE v.is_published = true AND (v.is_quarantined IS FALSE OR v.is_quarantined IS NULL) AND v.review_status != 'quarantined')::int AS public,
        count(*) FILTER (WHERE v.is_quarantined IS TRUE OR v.review_status = 'quarantined')::int AS quarantined,
        count(*) FILTER (WHERE v.review_status = 'approved' AND (v.is_quarantined IS FALSE OR v.is_quarantined IS NULL))::int AS approved
      FROM genomics.variant_clinical_assertions a
      JOIN genomics.variants v ON v.id = a.variant_id
    `,
  ]);

  return {
    ...overview,
    recordBreakdown: {
      diseases: diseaseBreakdownRows[0] || { total: 0, public: 0, quarantined: 0, approved: 0 },
      genes: geneBreakdownRows[0] || { total: 0, public: 0, quarantined: 0, approved: 0 },
      variants: variantBreakdownRows[0] || { total: 0, public: 0, quarantined: 0, approved: 0 },
      assertions: assertionBreakdownRows[0] || { total: 0, public: 0, quarantined: 0, approved: 0 },
    },
    diseases: diseases as any[],
    genes: genes as any[],
    variants: variants as any[],
    reviews: reviews as any[],
    sources: sources as any[],
    imports: imports as any[],
    audits: audits as any[],
    classifications: classifications as any[],
  };
}

export async function getClassificationHistory(variantIdOrLimit?: string | number, limit = 50) {
  const sql = getSql();
  if (typeof variantIdOrLimit === "string") {
    return await sql`
      SELECT ch.*, v.preferred_name, v.chromosome, v.position_vcf
      FROM genomics.classification_history ch
      LEFT JOIN genomics.variants v ON v.id = ch.variant_id
      WHERE ch.variant_id = ${variantIdOrLimit}
      ORDER BY ch.changed_at DESC
      LIMIT ${limit}
    `;
  }
  const lim = typeof variantIdOrLimit === "number" ? variantIdOrLimit : 50;
  return await sql`
    SELECT ch.*, v.preferred_name, v.chromosome, v.position_vcf
    FROM genomics.classification_history ch
    LEFT JOIN genomics.variants v ON v.id = ch.variant_id
    ORDER BY ch.changed_at DESC
    LIMIT ${lim}
  `;
}

export async function cancelImportJob(jobId: string, reason?: string, actorEmail?: string) {
  const sql = getSql();
  await sql`
    UPDATE genomics.import_jobs
    SET status = 'cancelled',
        cancelled_at = NOW(),
        cancellation_reason = ${reason || "Cancelled by administrator"},
        current_stage = 'cancelled'
    WHERE id = ${jobId}
  `;

  // Release ingestion lock owned by this job (or any expired lock), preserving unrelated active locks
  await sql`
    DELETE FROM genomics.ingestion_locks
    WHERE expires_at < NOW()
       OR acquired_by LIKE ${"%" + jobId + "%"}
  `;

  await sql`
    INSERT INTO genomics.audit_logs (actor_email, action, entity_type, entity_id, details)
    VALUES (${actorEmail || 'admin@akahelix.com'}, 'sync_cancelled', 'import_job', ${jobId}, ${JSON.stringify({ reason })}::jsonb)
  `;
  return { success: true };
}

export async function quarantineRecord(data: {
  entityType: "disease" | "gene" | "variant";
  entityId: string;
  reason: string;
  actorEmail: string;
}) {
  const sql = getSql();

  if (data.entityType === "disease") {
    await sql`
      UPDATE genomics.diseases
      SET is_quarantined = true,
          is_published = false,
          review_status = 'quarantined',
          quarantine_reason = ${data.reason},
          updated_at = NOW()
      WHERE id::text = ${data.entityId} OR slug = ${data.entityId}
    `;
  } else if (data.entityType === "gene") {
    await sql`
      UPDATE genomics.genes
      SET is_quarantined = true,
          is_published = false,
          review_status = 'quarantined',
          quarantine_reason = ${data.reason},
          updated_at = NOW()
      WHERE id::text = ${data.entityId} OR UPPER(symbol) = UPPER(${data.entityId})
    `;
  } else if (data.entityType === "variant") {
    await sql`
      UPDATE genomics.variants
      SET is_quarantined = true,
          is_published = false,
          review_status = 'quarantined',
          quarantine_reason = ${data.reason},
          updated_at = NOW()
      WHERE id::text = ${data.entityId} OR clinvar_vcv = ${data.entityId}
    `;
  }

  // Create audit log entry
  await sql`
    INSERT INTO genomics.audit_logs (
      actor_email, action, entity_type, entity_id, details
    )
    VALUES (
      ${data.actorEmail}, 'QUARANTINE_RECORD',
      ${data.entityType}, ${data.entityId},
      ${JSON.stringify({ reason: data.reason })}::jsonb
    )
  `;
}

export async function getImportJobsAndCheckpoints(jobId?: string) {
  const sql = getSql();
  if (jobId) {
    const [job] = await sql`SELECT * FROM genomics.import_jobs WHERE id = ${jobId}`;
    const checkpoints = await sql`
      SELECT * FROM genomics.ingestion_checkpoints
      WHERE job_id = ${jobId}
      ORDER BY updated_at ASC
    `;
    return { job, checkpoints };
  }

  const jobs = await sql`
    SELECT * FROM genomics.import_jobs
    ORDER BY created_at DESC
    LIMIT 20
  `;
  return { jobs };
}

// ============================================================================
// Phase 06: Analytics, Relationship Graph, Provenance & Public Exports
// ============================================================================

export async function getGenomicsAnalytics() {
  const sql = getSql();

  const [
    diseases,
    genes,
    variants,
    diseaseGeneLinks,
    variantGeneLinks,
    variantDiseaseLinks,
    geneChroms,
    variantChroms,
    classificationBreakdown,
    reviewBreakdown,
    publicationTrends,
    provenanceSources,
    recentClassificationHistory,
  ] = await Promise.all([
    sql`
      SELECT id, slug, name, omim_id, inheritance_mode, review_status
      FROM genomics.diseases
      WHERE is_published = true AND (is_quarantined IS FALSE OR is_quarantined IS NULL) AND review_status != 'quarantined'
      ORDER BY name ASC
    `,
    sql`
      SELECT id, symbol, name, chromosome, hgnc_id, review_status
      FROM genomics.genes
      WHERE is_published = true AND (is_quarantined IS FALSE OR is_quarantined IS NULL) AND review_status != 'quarantined'
      ORDER BY symbol ASC
    `,
    sql`
      SELECT id, clinvar_vcv, preferred_name, chromosome, clinical_significance, gold_stars, review_status
      FROM genomics.variants
      WHERE is_published = true AND (is_quarantined IS FALSE OR is_quarantined IS NULL) AND review_status != 'quarantined'
      ORDER BY gold_stars DESC, preferred_name ASC
    `,
    sql`
      SELECT dgr.disease_id, dgr.gene_id, dgr.relationship_type, dgr.evidence_level
      FROM genomics.disease_gene_relationships dgr
      JOIN genomics.diseases d ON d.id = dgr.disease_id
      JOIN genomics.genes g ON g.id = dgr.gene_id
      WHERE d.is_published = true AND (d.is_quarantined IS FALSE OR d.is_quarantined IS NULL) AND d.review_status != 'quarantined'
        AND g.is_published = true AND (g.is_quarantined IS FALSE OR g.is_quarantined IS NULL) AND g.review_status != 'quarantined'
    `,
    sql`
      SELECT vgr.variant_id, vgr.gene_id, vgr.consequence
      FROM genomics.variant_gene_relationships vgr
      JOIN genomics.variants v ON v.id = vgr.variant_id
      JOIN genomics.genes g ON g.id = vgr.gene_id
      WHERE v.is_published = true AND (v.is_quarantined IS FALSE OR v.is_quarantined IS NULL) AND v.review_status != 'quarantined'
        AND g.is_published = true AND (g.is_quarantined IS FALSE OR g.is_quarantined IS NULL) AND g.review_status != 'quarantined'
    `,
    sql`
      SELECT vdr.variant_id, vdr.disease_id, vdr.clinical_significance
      FROM genomics.variant_disease_relationships vdr
      JOIN genomics.variants v ON v.id = vdr.variant_id
      JOIN genomics.diseases d ON d.id = vdr.disease_id
      WHERE v.is_published = true AND (v.is_quarantined IS FALSE OR v.is_quarantined IS NULL) AND v.review_status != 'quarantined'
        AND d.is_published = true AND (d.is_quarantined IS FALSE OR d.is_quarantined IS NULL) AND d.review_status != 'quarantined'
    `,
    sql`
      SELECT COALESCE(chromosome, 'Unknown') AS chromosome, count(*)::int AS count
      FROM genomics.genes
      WHERE is_published = true AND (is_quarantined IS FALSE OR is_quarantined IS NULL) AND review_status != 'quarantined'
      GROUP BY COALESCE(chromosome, 'Unknown')
    `,
    sql`
      SELECT COALESCE(chromosome, 'Unknown') AS chromosome, count(*)::int AS count
      FROM genomics.variants
      WHERE is_published = true AND (is_quarantined IS FALSE OR is_quarantined IS NULL) AND review_status != 'quarantined'
      GROUP BY COALESCE(chromosome, 'Unknown')
    `,
    sql`
      SELECT COALESCE(clinical_significance, 'Unclassified') AS label, count(*)::int AS count
      FROM genomics.variants
      WHERE is_published = true AND (is_quarantined IS FALSE OR is_quarantined IS NULL) AND review_status != 'quarantined'
      GROUP BY COALESCE(clinical_significance, 'Unclassified')
      ORDER BY count DESC
    `,
    sql`
      SELECT COALESCE(review_status, 'pending_review') AS status, count(*)::int AS count
      FROM genomics.variants
      WHERE is_published = true AND (is_quarantined IS FALSE OR is_quarantined IS NULL) AND review_status != 'quarantined'
      GROUP BY COALESCE(review_status, 'pending_review')
      ORDER BY count DESC
    `,
    sql`
      SELECT pub_year AS year, count(*)::int AS count
      FROM genomics.publications
      WHERE pub_year IS NOT NULL
      GROUP BY pub_year
      ORDER BY pub_year ASC
    `,
    sql`
      SELECT
        ds.id,
        ds.name,
        ds.base_url,
        ds.license_type,
        ds.is_active,
        dv.version_tag,
        dv.retrieval_date,
        dv.record_count
      FROM genomics.data_sources ds
      LEFT JOIN LATERAL (
        SELECT version_tag, retrieval_date, record_count
        FROM genomics.dataset_versions
        WHERE data_source_id = ds.id
        ORDER BY retrieval_date DESC
        LIMIT 1
      ) dv ON true
      WHERE ds.is_active = true
      ORDER BY ds.name ASC
    `,
    sql`
      SELECT
        ch.id,
        ch.variant_id,
        ch.clinvar_vcv,
        v.preferred_name,
        ch.previous_classification,
        ch.new_classification,
        ch.previous_gold_stars,
        ch.new_gold_stars,
        ch.source_data_source,
        ch.change_summary,
        ch.changed_at
      FROM genomics.classification_history ch
      JOIN genomics.variants v ON v.id = ch.variant_id
      WHERE v.is_published = true AND (v.is_quarantined IS FALSE OR v.is_quarantined IS NULL) AND v.review_status != 'quarantined'
      ORDER BY ch.changed_at DESC
      LIMIT 15
    `,
  ]);

  // Merge chromosome distribution (natural sort: 1..22, X, Y, MT, Unknown)
  const chromMap = new Map<string, { chromosome: string; genesCount: number; variantsCount: number }>();
  for (const r of geneChroms as any[]) {
    const c = String(r.chromosome);
    const entry = chromMap.get(c) || { chromosome: c, genesCount: 0, variantsCount: 0 };
    entry.genesCount = Number(r.count);
    chromMap.set(c, entry);
  }
  for (const r of variantChroms as any[]) {
    const c = String(r.chromosome);
    const entry = chromMap.get(c) || { chromosome: c, genesCount: 0, variantsCount: 0 };
    entry.variantsCount = Number(r.count);
    chromMap.set(c, entry);
  }
  const chromosomeDistribution = Array.from(chromMap.values()).sort((a, b) => {
    const na = parseInt(a.chromosome, 10);
    const nb = parseInt(b.chromosome, 10);
    if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
    if (!Number.isNaN(na)) return -1;
    if (!Number.isNaN(nb)) return 1;
    return a.chromosome.localeCompare(b.chromosome);
  });

  return {
    relationships: {
      diseases: diseases as any[],
      genes: genes as any[],
      variants: variants as any[],
      diseaseGeneLinks: diseaseGeneLinks as any[],
      variantGeneLinks: variantGeneLinks as any[],
      variantDiseaseLinks: variantDiseaseLinks as any[],
    },
    chromosomeDistribution,
    classificationStats: {
      bySignificance: classificationBreakdown as any[],
      byReviewStatus: reviewBreakdown as any[],
    },
    publicationTrends: publicationTrends as any[],
    provenanceSources: provenanceSources as any[],
    recentClassificationHistory: recentClassificationHistory as any[],
  };
}

function escapeCsvCell(val: unknown): string {
  if (val === null || val === undefined) return "";
  const str = typeof val === "object" ? JSON.stringify(val) : String(val);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function exportPublicGenomicsRecords(options: {
  format: "csv" | "json";
  entity?: SearchCategory | undefined;
  q?: string | undefined;
  significance?: string | undefined;
  chromosome?: string | undefined;
  inheritance?: string | undefined;
  evidenceLevel?: string | undefined;
  reviewStatus?: string | undefined;
}) {
  const results = await searchGenomics(options.q || "", {
    category: options.entity || "all",
    significance: options.significance,
    chromosome: options.chromosome,
    inheritance: options.inheritance,
    evidenceLevel: options.evidenceLevel,
    reviewStatus: options.reviewStatus,
    limit: 100,
  });

  const rows: Record<string, unknown>[] = [];

  for (const d of results.diseases) {
    rows.push({
      entity_type: "disease",
      id: d.id,
      identifier: d.omim_id || d.concept_id || d.slug,
      name_or_symbol: d.name,
      secondary_info: d.inheritance_mode || "",
      chromosome: "",
      clinical_significance: "",
      review_status: d.review_status,
      hgvs_or_accession: d.mondo_id || d.orpha_code || d.concept_id || "",
    });
  }

  for (const g of results.genes) {
    rows.push({
      entity_type: "gene",
      id: g.id,
      identifier: g.hgnc_id || g.entrez_gene_id || g.symbol,
      name_or_symbol: g.symbol,
      secondary_info: g.name,
      chromosome: g.chromosome || "",
      clinical_significance: "",
      review_status: g.review_status,
      hgvs_or_accession: g.cytoband || "",
    });
  }

  for (const v of results.variants) {
    rows.push({
      entity_type: "variant",
      id: v.id,
      identifier: v.clinvar_vcv,
      name_or_symbol: v.preferred_name,
      secondary_info: v.dbsnp_id || "",
      chromosome: v.chromosome || "",
      clinical_significance: v.clinical_significance || "",
      review_status: v.review_status,
      hgvs_or_accession: v.hgvs_cdna || v.hgvs_protein || "",
    });
  }

  for (const p of results.phenotypes) {
    rows.push({
      entity_type: "phenotype",
      id: p.id,
      identifier: p.hpo_id,
      name_or_symbol: p.term,
      secondary_info: p.definition || "",
      chromosome: "",
      clinical_significance: "",
      review_status: "published",
      hgvs_or_accession: p.hpo_id,
    });
  }

  for (const pub of results.publications) {
    rows.push({
      entity_type: "publication",
      id: pub.id,
      identifier: pub.pmid ? `PMID:${pub.pmid}` : pub.doi || pub.id,
      name_or_symbol: pub.title,
      secondary_info: `${pub.journal || ""} (${pub.pub_year || ""})`,
      chromosome: "",
      clinical_significance: "",
      review_status: "published",
      hgvs_or_accession: pub.doi || "",
    });
  }

  if (options.format === "json") {
    return {
      contentType: "application/json; charset=utf-8",
      filename: `akahelix-genomics-public-export-${new Date().toISOString().split("T")[0]}.json`,
      body: JSON.stringify(
        {
          exportedAt: new Date().toISOString(),
          scope: "eligible_public_records_only",
          filters: {
            entity: options.entity || "all",
            q: options.q || "",
            chromosome: options.chromosome || null,
            inheritance: options.inheritance || null,
            significance: options.significance || null,
            evidenceLevel: options.evidenceLevel || null,
            reviewStatus: options.reviewStatus || null,
          },
          total: rows.length,
          records: rows,
        },
        null,
        2
      ),
    };
  }

  const headers = [
    "entity_type",
    "id",
    "identifier",
    "name_or_symbol",
    "secondary_info",
    "chromosome",
    "clinical_significance",
    "review_status",
    "hgvs_or_accession",
  ];
  const csvLines = [
    headers.join(","),
    ...rows.map((row) => headers.map((h) => escapeCsvCell(row[h])).join(",")),
  ];

  return {
    contentType: "text/csv; charset=utf-8",
    filename: `akahelix-genomics-public-export-${new Date().toISOString().split("T")[0]}.csv`,
    body: csvLines.join("\n"),
  };
}
