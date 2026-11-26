import { z } from "zod";

// ============================================================================
// Data Source & Provenance
// ============================================================================
export const DataSourceSchema = z.object({
  id: z.string(),
  name: z.string(),
  baseUrl: z.string().url(),
  description: z.string().nullable().optional(),
  licenseType: z.string(),
  termsUrl: z.string().nullable().optional(),
  isActive: z.boolean(),
  createdAt: z.string().optional(),
});
export type DataSource = z.infer<typeof DataSourceSchema>;

// ============================================================================
// Disease Types
// ============================================================================
export const DiseaseSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
  conceptId: z.string().nullable().optional(), // MedGen CUI
  omimId: z.string().nullable().optional(),
  orphaCode: z.string().nullable().optional(),
  mondoId: z.string().nullable().optional(),
  icd10: z.string().nullable().optional(),
  inheritanceMode: z.string().nullable().optional(),
  definition: z.string().nullable().optional(),
  sourceRecord: z.record(z.any()).default({}),
  curatedSummary: z.string().nullable().optional(),
  clinicalSynopsis: z.record(z.any()).default({}),
  reviewStatus: z.enum(["source_imported", "under_review", "curated", "approved"]).default("source_imported"),
  isPublished: z.boolean().default(true),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});
export type Disease = z.infer<typeof DiseaseSchema>;

// ============================================================================
// Gene Types
// ============================================================================
export const GeneSchema = z.object({
  id: z.string().uuid(),
  symbol: z.string(),
  name: z.string(),
  entrezGeneId: z.string().nullable().optional(),
  hgncId: z.string().nullable().optional(),
  ensemblGeneId: z.string().nullable().optional(),
  omimId: z.string().nullable().optional(),
  chromosome: z.string().nullable().optional(),
  cytogeneticLocation: z.string().nullable().optional(),
  genomicCoordinates: z.record(z.any()).default({}),
  geneType: z.string().default("protein-coding"),
  summary: z.string().nullable().optional(),
  sourceRecord: z.record(z.any()).default({}),
  curatedNotes: z.string().nullable().optional(),
  reviewStatus: z.enum(["source_imported", "under_review", "curated", "approved"]).default("source_imported"),
  isPublished: z.boolean().default(true),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});
export type Gene = z.infer<typeof GeneSchema>;

// ============================================================================
// Variant Types
// ============================================================================
export const VariantSchema = z.object({
  id: z.string().uuid(),
  clinvarVcv: z.string().nullable().optional(),
  preferredName: z.string(),
  hgvsCdna: z.string().nullable().optional(),
  hgvsProtein: z.string().nullable().optional(),
  hgvsGenomic: z.string().nullable().optional(),
  dbsnpId: z.string().nullable().optional(),
  variantType: z.string().default("single nucleotide variant"),
  molecularConsequence: z.string().nullable().optional(),
  assembly: z.string().default("GRCh38"),
  chromosome: z.string().nullable().optional(),
  positionVcf: z.number().nullable().optional(),
  refAllele: z.string().nullable().optional(),
  altAllele: z.string().nullable().optional(),
  sourceRecord: z.record(z.any()).default({}),
  reviewStatus: z.enum(["source_imported", "under_review", "curated", "approved"]).default("source_imported"),
  isPublished: z.boolean().default(true),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});
export type Variant = z.infer<typeof VariantSchema>;

// ============================================================================
// Relationship Types
// ============================================================================
export const DiseaseGeneRelationshipSchema = z.object({
  id: z.string().uuid(),
  diseaseId: z.string().uuid(),
  geneId: z.string().uuid(),
  relationshipType: z.string().default("causative"),
  evidenceLevel: z.string().default("Definitive"),
  inheritancePattern: z.string().nullable().optional(),
  sourceId: z.string().nullable().optional(),
  sourceEvidence: z.record(z.any()).default({}),
  curatorNotes: z.string().nullable().optional(),
  createdAt: z.string().optional(),
});
export type DiseaseGeneRelationship = z.infer<typeof DiseaseGeneRelationshipSchema>;

export const VariantGeneRelationshipSchema = z.object({
  id: z.string().uuid(),
  variantId: z.string().uuid(),
  geneId: z.string().uuid(),
  relationshipType: z.string().default("located_in"),
  exonNumber: z.number().nullable().optional(),
  intronNumber: z.number().nullable().optional(),
  consequence: z.string().nullable().optional(),
  createdAt: z.string().optional(),
});
export type VariantGeneRelationship = z.infer<typeof VariantGeneRelationshipSchema>;

export const VariantDiseaseRelationshipSchema = z.object({
  id: z.string().uuid(),
  variantId: z.string().uuid(),
  diseaseId: z.string().uuid(),
  clinicalSignificance: z.string(),
  reviewStatusClinvar: z.string().nullable().optional(),
  goldStars: z.number().default(0),
  sourceEvidence: z.record(z.any()).default({}),
  createdAt: z.string().optional(),
});
export type VariantDiseaseRelationship = z.infer<typeof VariantDiseaseRelationshipSchema>;

// ============================================================================
// Clinical Assertion
// ============================================================================
export const ClinicalAssertionSchema = z.object({
  id: z.string().uuid(),
  variantId: z.string().uuid(),
  rcvAccession: z.string().nullable().optional(),
  scvAccession: z.string().nullable().optional(),
  submitterName: z.string(),
  clinicalSignificance: z.string(),
  diseaseName: z.string().nullable().optional(),
  assertionCriteria: z.string().nullable().optional(),
  dateLastEvaluated: z.string().nullable().optional(),
  submissionDate: z.string().nullable().optional(),
  reviewStatus: z.string().nullable().optional(),
  citations: z.array(z.string()).default([]),
  rawAssertion: z.record(z.any()).default({}),
  createdAt: z.string().optional(),
});
export type ClinicalAssertion = z.infer<typeof ClinicalAssertionSchema>;

// ============================================================================
// Phenotype Types
// ============================================================================
export const PhenotypeSchema = z.object({
  id: z.string().uuid(),
  hpoId: z.string(),
  term: z.string(),
  definition: z.string().nullable().optional(),
  createdAt: z.string().optional(),
});
export type Phenotype = z.infer<typeof PhenotypeSchema>;

// ============================================================================
// Publication Types
// ============================================================================
export const PublicationSchema = z.object({
  id: z.string().uuid(),
  pmid: z.string(),
  pmcid: z.string().nullable().optional(),
  doi: z.string().nullable().optional(),
  title: z.string(),
  authors: z.array(z.string()).default([]),
  journal: z.string().nullable().optional(),
  pubYear: z.number().nullable().optional(),
  pubDate: z.string().nullable().optional(),
  abstract: z.string().nullable().optional(),
  sourceRecord: z.record(z.any()).default({}),
  createdAt: z.string().optional(),
});
export type Publication = z.infer<typeof PublicationSchema>;

// ============================================================================
// Scientific Review & Audit
// ============================================================================
export const ScientificReviewSchema = z.object({
  id: z.string().uuid(),
  entityType: z.enum(["disease", "gene", "variant"]),
  entityId: z.string().uuid(),
  reviewerEmail: z.string().email(),
  reviewerName: z.string(),
  action: z.enum(["reviewed", "flagged", "annotated", "approved", "published"]),
  notes: z.string(),
  previousStatus: z.string().nullable().optional(),
  newStatus: z.string().nullable().optional(),
  createdAt: z.string().optional(),
});
export type ScientificReview = z.infer<typeof ScientificReviewSchema>;

export const AuditLogSchema = z.object({
  id: z.string().uuid(),
  actorEmail: z.string(),
  action: z.string(),
  entityType: z.string(),
  entityId: z.string(),
  details: z.record(z.any()).default({}),
  ipAddress: z.string().nullable().optional(),
  createdAt: z.string().optional(),
});
export type AuditLog = z.infer<typeof AuditLogSchema>;

// ============================================================================
// Search & Filter Parameters
// ============================================================================
export const GenomicsSearchParamsSchema = z.object({
  q: z.string().default(""),
  type: z.enum(["all", "diseases", "genes", "variants", "publications"]).default("all"),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  chromosome: z.string().optional(),
  inheritance: z.string().optional(),
  significance: z.string().optional(),
});
export type GenomicsSearchParams = z.infer<typeof GenomicsSearchParamsSchema>;
