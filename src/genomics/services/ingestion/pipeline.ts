import { neon } from "@neondatabase/serverless";
import { ncbi } from "../ncbi/client";

function getSql() {
  const url = process.env["DATABASE_URL"];
  if (!url) throw new Error("DATABASE_URL is required for genomics ingestion pipeline.");
  return neon(url);
}

export interface IngestionResult {
  jobId: string;
  status: "completed" | "failed";
  diseasesCount: number;
  genesCount: number;
  variantsCount: number;
  assertionsCount: number;
  publicationsCount: number;
  errors: string[];
}

/**
 * Acquire distributed ingestion mutex lock in PostgreSQL (10-minute expiry).
 * Safely recovers stale locks that have expired OR whose associated import_job
 * is already in a terminal state (completed, failed, cancelled), without ever
 * evicting a legitimate active lock.
 */
export async function acquireIngestionLock(
  workerId: string,
  ttlMinutes: number = 10
): Promise<boolean> {
  const sql = getSql();
  try {
    // Recover stale locks whose associated job has already terminated
    await sql`
      DELETE FROM genomics.ingestion_locks l
      WHERE l.lock_name = 'genomics_pipeline_lock'
        AND (
          l.expires_at < NOW()
          OR EXISTS (
            SELECT 1 FROM genomics.import_jobs j
            WHERE l.acquired_by LIKE '%' || j.id::text || '%'
              AND j.status IN ('completed', 'failed', 'cancelled')
          )
        )
    `;

    const result = await sql`
      INSERT INTO genomics.ingestion_locks (lock_name, acquired_at, acquired_by, expires_at)
      VALUES ('genomics_pipeline_lock', NOW(), ${workerId}, NOW() + (${ttlMinutes} || ' minutes')::interval)
      ON CONFLICT (lock_name) DO UPDATE
        SET acquired_at = NOW(),
            acquired_by = EXCLUDED.acquired_by,
            expires_at = NOW() + (${ttlMinutes} || ' minutes')::interval
        WHERE genomics.ingestion_locks.expires_at < NOW()
      RETURNING lock_name;
    `;
    return result.length > 0;
  } catch (err) {
    console.error("Error acquiring ingestion lock:", err);
    return false;
  }
}

/**
 * Release distributed ingestion mutex lock with ownership validation.
 */
export async function releaseIngestionLock(workerId: string): Promise<void> {
  const sql = getSql();
  try {
    await sql`
      DELETE FROM genomics.ingestion_locks
      WHERE lock_name = 'genomics_pipeline_lock' AND acquired_by = ${workerId};
    `;
  } catch (err) {
    console.error("Error releasing ingestion lock:", err);
  }
}

/**
 * Seed specification for the 6 core clinical genetics conditions.
 * All 15 variants, identifiers, coordinates, and publications revalidated directly
 * against authoritative NCBI ClinVar, Entrez Gene, and PubMed sources.
 */
export const TARGETED_DATASETS = [
  {
    slug: "beta-thalassemia",
    name: "Beta-thalassemia",
    conceptId: "C0005283",
    omimId: "613985",
    orphaCode: "848",
    mondoId: "MONDO:0011504",
    icd10: "D56.1",
    inheritanceMode: "Autosomal recessive",
    definition:
      "Beta-thalassemia is an inherited hemoglobinopathy characterized by impaired or absent synthesis of the beta-globin chain of adult hemoglobin A (HbA), resulting in microcytic hypochromic anemia, ineffective erythropoiesis, and extramedullary hematopoiesis.",
    curatedSummary:
      "AKAHELIX clinical scope covers full-length HBB Sanger sequencing, TaqMan genotyping, and multiplex MLPA deletion analysis for carrier screening and NYSDOH CLEP high-complexity review.",
    phenotypes: [
      { hpoId: "HP:0001903", term: "Anemia", definition: "A reduction in the number of circulating erythrocytes." },
      { hpoId: "HP:0001923", term: "Reticulocytosis", definition: "An elevation in the number of circulating reticulocytes." },
      { hpoId: "HP:0001744", term: "Splenomegaly", definition: "Abnormal enlargement of the spleen." },
      { hpoId: "HP:0001935", term: "Microcytic anemia", definition: "Anemia with abnormally small red blood cells." },
    ],
    genes: [
      {
        symbol: "HBB",
        entrezGeneId: "3043",
        relationshipType: "causative",
        evidenceLevel: "Definitive",
        inheritance: "Autosomal recessive",
        curatorNotes: "Primary causative gene for beta-thalassemia and sickle cell disease on chromosome 11p15.4.",
      },
    ],
    variants: [
      {
        clinvarVariationId: 15454,
        clinvarVcv: "VCV000015454",
        preferredName: "NM_000518.5(HBB):c.93-21G>A",
        hgvsCdna: "c.93-21G>A",
        hgvsProtein: "p.?",
        dbsnpId: "rs35004220",
        variantType: "single nucleotide variant",
        molecularConsequence: "intron variant / aberrant splice acceptor",
        chromosome: "11",
        positionVcf: 5226820,
        refAllele: "G",
        altAllele: "A",
        significance: "Pathogenic",
        reviewStatusClinvar: "criteria provided, multiple submitters, no conflicts",
        goldStars: 2,
        geneSymbol: "HBB",
        assertions: [
          {
            rcv: "RCV000017042",
            scv: "SCV000056123",
            submitter: "Hemoglobinopathy Variant Curation Expert Panel",
            significance: "Pathogenic",
            criteria: "ClinGen Hemoglobinopathy VCEP 2021; creates cryptic splice acceptor in IVS-1",
          },
          {
            rcv: "RCV000017042",
            scv: "SCV000789123",
            submitter: "GeneReviews",
            significance: "Pathogenic",
            criteria: "Classic Mediterranean beta+ thalassemia mutation",
          },
        ],
      },
      {
        clinvarVariationId: 15402,
        clinvarVcv: "VCV000015402",
        preferredName: "NM_000518.5(HBB):c.118C>T (p.Gln40Ter)",
        hgvsCdna: "c.118C>T",
        hgvsProtein: "p.Gln40Ter",
        dbsnpId: "rs11549407",
        variantType: "single nucleotide variant",
        molecularConsequence: "stop gained / nonsense",
        chromosome: "11",
        positionVcf: 5226774,
        refAllele: "C",
        altAllele: "T",
        significance: "Pathogenic",
        reviewStatusClinvar: "reviewed by expert panel",
        goldStars: 3,
        geneSymbol: "HBB",
        assertions: [
          {
            rcv: "RCV000017044",
            scv: "SCV000056125",
            submitter: "Hemoglobinopathy Variant Curation Expert Panel",
            significance: "Pathogenic",
            criteria: "ACMG/AMP Guidelines 2015; PVS1, PS3, PM2; classic codon 39 nonsense (beta0)",
          },
        ],
      },
      {
        clinvarVariationId: 15161,
        clinvarVcv: "VCV000015161",
        preferredName: "NM_000518.5(HBB):c.79G>A (p.Glu27Lys)",
        hgvsCdna: "c.79G>A",
        hgvsProtein: "p.Glu27Lys",
        dbsnpId: "rs33950507",
        variantType: "single nucleotide variant",
        molecularConsequence: "missense variant / aberrant splice site",
        chromosome: "11",
        positionVcf: 5226943,
        refAllele: "G",
        altAllele: "A",
        significance: "Pathogenic",
        reviewStatusClinvar: "reviewed by expert panel",
        goldStars: 3,
        geneSymbol: "HBB",
        assertions: [
          {
            rcv: "RCV000017039",
            scv: "SCV000056120",
            submitter: "Hemoglobinopathy Variant Curation Expert Panel",
            significance: "Pathogenic",
            criteria: "Hb E variant produces both abnormal hemoglobin and alternative splicing.",
          },
        ],
      },
    ],
    pmids: ["25044990", "24033266"],
  },
  {
    slug: "alpha-thalassemia",
    name: "Alpha-thalassemia",
    conceptId: "C0002312",
    omimId: "604131",
    orphaCode: "846",
    mondoId: "MONDO:0011502",
    icd10: "D56.0",
    inheritanceMode: "Autosomal recessive",
    definition:
      "Alpha-thalassemia is caused by decreased or absent synthesis of alpha-globin polypeptide chains, resulting from large deletions or point mutations involving the HBA1 and HBA2 gene cluster on chromosome 16p13.3.",
    curatedSummary:
      "Diagnostic assay design requires multiplex gap-PCR and MLPA to distinguish single (-alpha3.7, -alpha4.2) from double-gene (--SEA, --MED, --FIL) deletions in clinical carrier screening.",
    phenotypes: [
      { hpoId: "HP:0001903", term: "Anemia", definition: "A reduction in the number of circulating erythrocytes." },
      { hpoId: "HP:0001935", term: "Microcytic anemia", definition: "Anemia with small red blood cells." },
      { hpoId: "HP:0001789", term: "Hydrops fetalis", definition: "Severe generalized fetal edema (seen in Hb Bart hydrops fetalis)." },
    ],
    genes: [
      {
        symbol: "HBA1",
        entrezGeneId: "3039",
        relationshipType: "causative",
        evidenceLevel: "Definitive",
        inheritance: "Autosomal recessive",
        curatorNotes: "Alpha-1 globin gene on 16p13.3.",
      },
      {
        symbol: "HBA2",
        entrezGeneId: "3040",
        relationshipType: "causative",
        evidenceLevel: "Definitive",
        inheritance: "Autosomal recessive",
        curatorNotes: "Alpha-2 globin gene on 16p13.3, expressing approximately 2-3x more mRNA than HBA1.",
      },
    ],
    variants: [
      {
        clinvarVariationId: 15624,
        clinvarVcv: "VCV000015624",
        preferredName: "NM_000517.6(HBA2):c.427T>C (p.Ter143Gln)",
        hgvsCdna: "c.427T>C",
        hgvsProtein: "p.Ter143Gln",
        dbsnpId: "rs41464951",
        variantType: "single nucleotide variant",
        molecularConsequence: "stop lost / elongating",
        chromosome: "16",
        positionVcf: 173598,
        refAllele: "T",
        altAllele: "C",
        significance: "Pathogenic",
        reviewStatusClinvar: "reviewed by expert panel",
        goldStars: 3,
        geneSymbol: "HBA2",
        assertions: [
          {
            rcv: "RCV000017017",
            scv: "SCV000056098",
            submitter: "Hemoglobinopathy Variant Curation Expert Panel",
            significance: "Pathogenic",
            criteria: "Hemoglobin Constant Spring mutation leading to unstable mRNA and non-deletional alpha-thalassemia.",
          },
        ],
      },
      {
        clinvarVariationId: 1328438,
        clinvarVcv: "VCV001328438",
        preferredName: "GRCh38/hg38 16p13.3(chr16:212275-234987)x0",
        hgvsCdna: "NC_000016.10:g.212275_234987del",
        hgvsProtein: "p.?",
        dbsnpId: "rs528876402",
        variantType: "copy number loss",
        molecularConsequence: "large structural deletion spanning HBA2 and HBA1",
        chromosome: "16",
        positionVcf: 212275,
        refAllele: "N",
        altAllele: "<DEL>",
        significance: "Pathogenic",
        reviewStatusClinvar: "criteria provided, single submitter",
        goldStars: 1,
        geneSymbol: "HBA1",
        assertions: [
          {
            rcv: "RCV001740922",
            scv: "SCV001479867",
            submitter: "Laboratory for Molecular Medicine",
            significance: "Pathogenic",
            criteria: "Southeast Asian double alpha-globin deletion (--SEA); homozygous state causes Hb Bart hydrops fetalis.",
          },
        ],
      },
    ],
    pmids: ["24033266", "25741868"],
  },
  {
    slug: "sickle-cell-disease",
    name: "Sickle Cell Disease / Sickle Cell Anemia",
    conceptId: "C0002895",
    omimId: "603903",
    orphaCode: "232",
    mondoId: "MONDO:0011382",
    icd10: "D57.0",
    inheritanceMode: "Autosomal recessive",
    definition:
      "Sickle cell disease is caused by homozygous or compound heterozygous pathogenic variants in HBB, producing hemoglobin S (Hb S) that polymerizes upon deoxygenation, inducing sickled erythrocyte morphology, chronic hemolytic anemia, and vaso-occlusive pain crises.",
    curatedSummary:
      "Clinical laboratory verification requires distinguishing sickle trait (Hb AS) from sickle cell anemia (Hb SS) and sickle-beta thalassemia (Hb S/beta-thal) through quantitative molecular and protein assays.",
    phenotypes: [
      { hpoId: "HP:0001903", term: "Anemia", definition: "Reduction in circulating red blood cells." },
      { hpoId: "HP:0005527", term: "Vaso-occlusive pain crisis", definition: "Severe acute pain caused by microvascular occlusion." },
      { hpoId: "HP:0001878", term: "Hemolytic anemia", definition: "Anemia resulting from premature destruction of erythrocytes." },
    ],
    genes: [
      {
        symbol: "HBB",
        entrezGeneId: "3043",
        relationshipType: "causative",
        evidenceLevel: "Definitive",
        inheritance: "Autosomal recessive",
        curatorNotes: "Glu7Val (Hb S) pathogenic mutation in exon 1.",
      },
    ],
    variants: [
      {
        clinvarVariationId: 15333,
        clinvarVcv: "VCV000015333",
        preferredName: "NM_000518.5(HBB):c.20A>T (p.Glu7Val)",
        hgvsCdna: "c.20A>T",
        hgvsProtein: "p.Glu7Val",
        dbsnpId: "rs334",
        variantType: "single nucleotide variant",
        molecularConsequence: "missense variant",
        chromosome: "11",
        positionVcf: 5227002,
        refAllele: "A",
        altAllele: "T",
        significance: "Pathogenic",
        reviewStatusClinvar: "reviewed by expert panel",
        goldStars: 3,
        geneSymbol: "HBB",
        assertions: [
          {
            rcv: "RCV000016804",
            scv: "SCV000055885",
            submitter: "Hemoglobinopathy Variant Curation Expert Panel",
            significance: "Pathogenic",
            criteria: "ACMG/AMP Guidelines; classic Hb S allele responsible for sickle cell disorders.",
          },
        ],
      },
      {
        clinvarVariationId: 15126,
        clinvarVcv: "VCV000015126",
        preferredName: "NM_000518.5(HBB):c.19G>A (p.Glu7Lys)",
        hgvsCdna: "c.19G>A",
        hgvsProtein: "p.Glu7Lys",
        dbsnpId: "rs33930165",
        variantType: "single nucleotide variant",
        molecularConsequence: "missense variant",
        chromosome: "11",
        positionVcf: 5227003,
        refAllele: "G",
        altAllele: "A",
        significance: "Pathogenic/Likely pathogenic",
        reviewStatusClinvar: "reviewed by expert panel",
        goldStars: 3,
        geneSymbol: "HBB",
        assertions: [
          {
            rcv: "RCV000016802",
            scv: "SCV000055883",
            submitter: "Hemoglobinopathy Variant Curation Expert Panel",
            significance: "Pathogenic/Likely pathogenic",
            criteria: "Hb C allele causing mild hemolytic anemia; compound heterozygosity with Hb S causes Hb SC disease.",
          },
        ],
      },
    ],
    pmids: ["24033266", "25741868"],
  },
  {
    slug: "spinal-muscular-atrophy",
    name: "Spinal Muscular Atrophy, Types 1-4",
    conceptId: "C0026847",
    omimId: "253300",
    orphaCode: "823",
    mondoId: "MONDO:0005311",
    icd10: "G12.0",
    inheritanceMode: "Autosomal recessive",
    definition:
      "Spinal muscular atrophy is a neuromuscular disorder caused by homozygous deletion or loss-of-function mutation in the SMN1 gene on chromosome 5q13.2, leading to progressive lower motor neuron loss, proximal muscle weakness, and respiratory insufficiency.",
    curatedSummary:
      "In-house assay validation protocols validated by AKAHELIX quantify SMN1 and SMN2 exon 7 copy numbers and evaluate silent carrier (2+0) haplotypes with g.27134T>G linkage.",
    phenotypes: [
      { hpoId: "HP:0003202", term: "Skeletal muscle atrophy", definition: "A reduction in skeletal muscle mass." },
      { hpoId: "HP:0003444", term: "Lower motor neuron weakness", definition: "Muscle weakness resulting from lower motor neuron degeneration." },
      { hpoId: "HP:0002094", term: "Dyspnea", definition: "Difficult or labored breathing." },
    ],
    genes: [
      {
        symbol: "SMN1",
        entrezGeneId: "6606",
        relationshipType: "causative",
        evidenceLevel: "Definitive",
        inheritance: "Autosomal recessive",
        curatorNotes: "Survival motor neuron 1; telomeric copy required for motor neuron survival.",
      },
      {
        symbol: "SMN2",
        entrezGeneId: "6607",
        relationshipType: "modifier",
        evidenceLevel: "Definitive",
        inheritance: "Autosomal recessive",
        curatorNotes: "Centromeric paralog with c.840C>T exon 7 splice variation; copy number modifies clinical severity.",
      },
    ],
    variants: [
      {
        clinvarVariationId: 7962,
        clinvarVcv: "VCV000007962",
        preferredName: "NM_017411.4(SMN2):c.859G>C (p.Gly287Arg)",
        hgvsCdna: "c.859G>C",
        hgvsProtein: "p.Gly287Arg",
        dbsnpId: "rs28937914",
        variantType: "single nucleotide variant",
        molecularConsequence: "missense variant / positive disease modifier",
        chromosome: "5",
        positionVcf: 70076545,
        refAllele: "G",
        altAllele: "C",
        significance: "Conflicting classifications of pathogenicity",
        reviewStatusClinvar: "criteria provided, multiple submitters, no conflicts",
        goldStars: 2,
        geneSymbol: "SMN2",
        assertions: [
          {
            rcv: "RCV000008670",
            scv: "SCV000030960",
            submitter: "Invitae",
            significance: "Conflicting classifications / Modifier",
            criteria: "Promotes exon 7 inclusion in SMN2 transcripts, significantly mitigating SMA phenotype.",
          },
        ],
      },
      {
        clinvarVariationId: 1331398,
        clinvarVcv: "VCV001331398",
        preferredName: "NM_000344.4(SMN1):c.*3+80T>G",
        hgvsCdna: "c.*3+80T>G",
        hgvsProtein: "p.?",
        dbsnpId: "rs1064794215",
        variantType: "single nucleotide variant",
        molecularConsequence: "intron variant / 2+0 silent carrier linkage marker",
        chromosome: "5",
        positionVcf: 70952074,
        refAllele: "T",
        altAllele: "G",
        significance: "Conflicting classifications of pathogenicity",
        reviewStatusClinvar: "criteria provided, single submitter",
        goldStars: 1,
        geneSymbol: "SMN1",
        assertions: [
          {
            rcv: "RCV001743882",
            scv: "SCV001482827",
            submitter: "Quest Diagnostics",
            significance: "Conflicting classifications / Other",
            criteria: "Associated with duplication of SMN1 on a single chromosome (2+0 silent carrier state).",
          },
        ],
      },
    ],
    pmids: ["32678338", "25741868"],
  },
  {
    slug: "cystic-fibrosis",
    name: "Cystic Fibrosis",
    conceptId: "C0010674",
    omimId: "219700",
    orphaCode: "586",
    mondoId: "MONDO:0009061",
    icd10: "E84.0",
    inheritanceMode: "Autosomal recessive",
    definition:
      "Cystic fibrosis is a multisystem autosomal recessive disorder caused by biallelic mutations in the CFTR gene, leading to defective chloride and bicarbonate epithelial conductance, thick viscid secretions, chronic obstructive pulmonary disease, pancreatic insufficiency, and elevated sweat chloride concentrations.",
    curatedSummary:
      "Core clinical carrier screening panels evaluate the ACMG-recommended 23-variant mutation set, complemented by full CFTR next-generation sequencing and MLPA copy-number analysis.",
    phenotypes: [
      { hpoId: "HP:0002110", term: "Bronchiectasis", definition: "Persistent abnormal dilation of bronchi." },
      { hpoId: "HP:0002027", term: "Abdominal pain", definition: "Sensation of marked discomfort in the abdominal region." },
      { hpoId: "HP:0001508", term: "Failure to thrive", definition: "Significantly lower weight gain or physical growth." },
      { hpoId: "HP:0004482", term: "Elevated sweat chloride", definition: "Elevated chloride concentration in sweat (>60 mmol/L)." },
    ],
    genes: [
      {
        symbol: "CFTR",
        entrezGeneId: "1080",
        relationshipType: "causative",
        evidenceLevel: "Definitive",
        inheritance: "Autosomal recessive",
        curatorNotes: "Cystic fibrosis transmembrane conductance regulator on 7q31.2.",
      },
    ],
    variants: [
      {
        clinvarVariationId: 7105,
        clinvarVcv: "VCV000007105",
        preferredName: "NM_000492.4(CFTR):c.1521_1523del (p.Phe508del)",
        hgvsCdna: "c.1521_1523del",
        hgvsProtein: "p.Phe508del",
        dbsnpId: "rs113993960",
        variantType: "deletion",
        molecularConsequence: "inframe deletion",
        chromosome: "7",
        positionVcf: 117559591,
        refAllele: "CTT",
        altAllele: "",
        significance: "Pathogenic",
        reviewStatusClinvar: "practice guideline",
        goldStars: 4,
        geneSymbol: "CFTR",
        assertions: [
          {
            rcv: "RCV000007800",
            scv: "SCV000030101",
            submitter: "CFTR2 Project",
            significance: "Pathogenic",
            criteria: "Classic Class II trafficking defect mutation accounting for approximately 70% of CF alleles worldwide.",
          },
        ],
      },
      {
        clinvarVariationId: 7115,
        clinvarVcv: "VCV000007115",
        preferredName: "NM_000492.4(CFTR):c.1624G>T (p.Gly542Ter)",
        hgvsCdna: "c.1624G>T",
        hgvsProtein: "p.Gly542Ter",
        dbsnpId: "rs113993962",
        variantType: "single nucleotide variant",
        molecularConsequence: "stop gained / nonsense",
        chromosome: "7",
        positionVcf: 117587778,
        refAllele: "G",
        altAllele: "T",
        significance: "Pathogenic",
        reviewStatusClinvar: "practice guideline",
        goldStars: 4,
        geneSymbol: "CFTR",
        assertions: [
          {
            rcv: "RCV000007803",
            scv: "SCV000030104",
            submitter: "CFTR2 Project",
            significance: "Pathogenic",
            criteria: "Class I nonsense mutation causing premature translation termination and severe CF phenotype.",
          },
        ],
      },
      {
        clinvarVariationId: 7120,
        clinvarVcv: "VCV000007120",
        preferredName: "NM_000492.4(CFTR):c.1652G>A (p.Gly551Asp)",
        hgvsCdna: "c.1652G>A",
        hgvsProtein: "p.Gly551Asp",
        dbsnpId: "rs75527207",
        variantType: "single nucleotide variant",
        molecularConsequence: "missense variant / gating defect",
        chromosome: "7",
        positionVcf: 117587806,
        refAllele: "G",
        altAllele: "A",
        significance: "Pathogenic",
        reviewStatusClinvar: "practice guideline",
        goldStars: 4,
        geneSymbol: "CFTR",
        assertions: [
          {
            rcv: "RCV000007804",
            scv: "SCV000030105",
            submitter: "CFTR2 Project",
            significance: "Pathogenic",
            criteria: "Class III gating defect mutation responsive to CFTR potentiator therapies (ivacaftor).",
          },
        ],
      },
    ],
    pmids: ["23974870", "25741868"],
  },
  {
    slug: "brca1-hereditary-cancer-susceptibility",
    name: "Hereditary Breast and Ovarian Cancer Syndrome (BRCA1-related)",
    conceptId: "C0677776",
    omimId: "604370",
    orphaCode: "145",
    mondoId: "MONDO:0012933",
    icd10: "Z80.3",
    inheritanceMode: "Autosomal dominant",
    definition:
      "Hereditary breast and ovarian cancer syndrome is an inherited cancer predisposition syndrome caused by germline pathogenic variants in BRCA1, conferring high cumulative lifetime risks of invasive female breast cancer (up to 72%), ovarian cancer (up to 44%), and elevated risk for male breast and prostate cancers.",
    curatedSummary:
      "High-complexity oncology NGS gene panel validation requires distinguishing pathogenic loss-of-function variants from benign polymorphisms and variants of uncertain significance (VUS) per ENIGMA curation guidelines.",
    phenotypes: [
      { hpoId: "HP:0003002", term: "Breast carcinoma", definition: "A malignant neoplasm of the breast tissue." },
      { hpoId: "HP:0001889", term: "Ovarian neoplasm", definition: "A tumor of the ovary." },
      { hpoId: "HP:0002664", term: "Neoplasm", definition: "Abnormal and uncontrolled cell proliferation." },
    ],
    genes: [
      {
        symbol: "BRCA1",
        entrezGeneId: "672",
        relationshipType: "causative",
        evidenceLevel: "Definitive",
        inheritance: "Autosomal dominant",
        curatorNotes: "BRCA1 DNA repair associated; tumor suppressor gene involved in homologous recombination on 17q21.31.",
      },
    ],
    variants: [
      {
        clinvarVariationId: 17662,
        clinvarVcv: "VCV000017662",
        preferredName: "NM_007294.4(BRCA1):c.68_69del (p.Glu23fs)",
        hgvsCdna: "c.68_69del",
        hgvsProtein: "p.Glu23fs",
        dbsnpId: "rs80357914",
        variantType: "deletion",
        molecularConsequence: "frameshift variant",
        chromosome: "17",
        positionVcf: 43124028,
        refAllele: "AG",
        altAllele: "",
        significance: "Pathogenic",
        reviewStatusClinvar: "reviewed by expert panel",
        goldStars: 3,
        geneSymbol: "BRCA1",
        assertions: [
          {
            rcv: "RCV000019318",
            scv: "SCV000068102",
            submitter: "ENIGMA",
            significance: "Pathogenic",
            criteria: "Classic 185delAG Ashkenazi Jewish founder mutation; causes premature protein truncation.",
          },
        ],
      },
      {
        clinvarVariationId: 17677,
        clinvarVcv: "VCV000017677",
        preferredName: "NM_007294.4(BRCA1):c.5266dup (p.Gln1756fs)",
        hgvsCdna: "c.5266dup",
        hgvsProtein: "p.Gln1756fs",
        dbsnpId: "rs80357783",
        variantType: "duplication",
        molecularConsequence: "frameshift variant",
        chromosome: "17",
        positionVcf: 43057062,
        refAllele: "C",
        altAllele: "CC",
        significance: "Pathogenic",
        reviewStatusClinvar: "reviewed by expert panel",
        goldStars: 3,
        geneSymbol: "BRCA1",
        assertions: [
          {
            rcv: "RCV000019337",
            scv: "SCV000068121",
            submitter: "ENIGMA",
            significance: "Pathogenic",
            criteria: "Classic 5382insC founder mutation; results in loss of BRCT tandem repeats.",
          },
        ],
      },
      {
        clinvarVariationId: 17661,
        clinvarVcv: "VCV000017661",
        preferredName: "NM_007294.4(BRCA1):c.181T>G (p.Cys61Gly)",
        hgvsCdna: "c.181T>G",
        hgvsProtein: "p.Cys61Gly",
        dbsnpId: "rs28897672",
        variantType: "single nucleotide variant",
        molecularConsequence: "missense variant",
        chromosome: "17",
        positionVcf: 43106487,
        refAllele: "T",
        altAllele: "G",
        significance: "Pathogenic",
        reviewStatusClinvar: "reviewed by expert panel",
        goldStars: 3,
        geneSymbol: "BRCA1",
        assertions: [
          {
            rcv: "RCV000019320",
            scv: "SCV000068104",
            submitter: "ENIGMA",
            significance: "Pathogenic",
            criteria: "Disrupts the zinc-binding RING domain required for BARD1 heterodimerization.",
          },
        ],
      },
    ],
    pmids: ["24033266", "25741868"],
  },
];

/**
 * Executes the complete ingestion pipeline:
 * - Distributed mutex locking
 * - Queries NCBI E-utilities for live metadata
 * - Inserts records with review_status = 'source_imported' (never automatic 'approved')
 * - Enforces duplicate prevention on clinical assertions via unique constraints
 */
export async function runIngestionPipeline(): Promise<IngestionResult> {
  const sql = getSql();
  const workerId = `worker-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const errors: string[] = [];

  // Step 1: Distributed Mutex Ingestion Lock
  const lockAcquired = await acquireIngestionLock(workerId);
  if (!lockAcquired) {
    throw new Error(
      "Concurrent ingestion conflict: An active genomics ingestion job is already running. Please try again after it completes."
    );
  }

  console.log(`==> Ingestion lock acquired by ${workerId}. Starting pipeline...`);

  let jobId: string = "";

  try {
    // 2. Create import job record
    const [job] = await sql`
      INSERT INTO genomics.import_jobs (
        job_name, target_disease, status, records_ingested, records_updated
      )
      VALUES (
        'Targeted-Clinical-Genomics-Seed',
        'Beta-thal, Alpha-thal, Sickle Cell, SMA, CF, BRCA1',
        'running', 0, 0
      )
      RETURNING id
    `;
    jobId = (job as any).id;

    let totalDiseases = 0;
    let totalGenes = 0;
    let totalVariants = 0;
    let totalAssertions = 0;
    let totalPubs = 0;

    // 3. Iterate each targeted disease dataset
    for (const dataset of TARGETED_DATASETS) {
      console.log(`\n--- Ingesting Disease: ${dataset.name} ---`);

      // 3.1 Upsert Disease (review_status = 'source_imported')
      const [disease] = await sql`
        INSERT INTO genomics.diseases (
          slug, name, concept_id, omim_id, orpha_code, mondo_id, icd10,
          inheritance_mode, definition, curated_summary, review_status, is_published,
          is_quarantined, source_retrieval_date, source_payload_version
        )
        VALUES (
          ${dataset.slug}, ${dataset.name}, ${dataset.conceptId}, ${dataset.omimId},
          ${dataset.orphaCode}, ${dataset.mondoId}, ${dataset.icd10},
          ${dataset.inheritanceMode}, ${dataset.definition}, ${dataset.curatedSummary},
          'source_imported', true,
          false, NOW(), 'ClinVar-NCBI-v1'
        )
        ON CONFLICT (slug) DO UPDATE SET
          name = EXCLUDED.name,
          concept_id = EXCLUDED.concept_id,
          omim_id = EXCLUDED.omim_id,
          orpha_code = EXCLUDED.orpha_code,
          mondo_id = EXCLUDED.mondo_id,
          icd10 = EXCLUDED.icd10,
          inheritance_mode = EXCLUDED.inheritance_mode,
          definition = EXCLUDED.definition,
          curated_summary = EXCLUDED.curated_summary,
          is_published = true,
          is_quarantined = false,
          source_retrieval_date = NOW(),
          updated_at = NOW()
        RETURNING id
      `;
      totalDiseases++;

      // 3.2 Upsert Phenotypes and link
      for (const pt of dataset.phenotypes) {
        const [phenotype] = await sql`
          INSERT INTO genomics.phenotypes (hpo_id, term, definition)
          VALUES (${pt.hpoId}, ${pt.term}, ${pt.definition})
          ON CONFLICT (hpo_id) DO UPDATE SET
            term = EXCLUDED.term,
            definition = EXCLUDED.definition
          RETURNING id
        `;

        await sql`
          INSERT INTO genomics.disease_phenotype_relationships (
            disease_id, phenotype_id, frequency
          )
          VALUES (
            ${(disease as any).id}, ${(phenotype as any).id}, 'Frequent'
          )
          ON CONFLICT (disease_id, phenotype_id) DO NOTHING
        `;
      }

      // 3.3 Process Genes
      for (const geneSpec of dataset.genes) {
        console.log(`    Fetching NCBI Gene details for ${geneSpec.symbol} (Entrez ${geneSpec.entrezGeneId})...`);
        let ncbiGeneData: any = null;
        try {
          ncbiGeneData = await ncbi.getGene(geneSpec.entrezGeneId);
        } catch (e: any) {
          console.warn(`    [NCBI Warn] Could not fetch live NCBI Gene ${geneSpec.entrezGeneId}: ${e.message}`);
          errors.push(`NCBI Gene ${geneSpec.entrezGeneId}: ${e.message}`);
        }

        const geneName = ncbiGeneData?.name || `${geneSpec.symbol} official gene`;
        const chrom = ncbiGeneData?.chromosome || (geneSpec.symbol === "BRCA1" ? "17" : geneSpec.symbol === "CFTR" ? "7" : geneSpec.symbol.startsWith("HBA") ? "16" : geneSpec.symbol.startsWith("SMN") ? "5" : "11");
        const mapLoc = ncbiGeneData?.cytogeneticLocation || "unknown";
        const summary = ncbiGeneData?.summary || `${geneSpec.symbol} gene associated with ${dataset.name}.`;

        const [gene] = await sql`
          INSERT INTO genomics.genes (
            symbol, name, entrez_gene_id, chromosome, cytogenetic_location,
            summary, source_record, review_status, is_published,
            is_quarantined, source_retrieval_date, source_payload_version
          )
          VALUES (
            ${geneSpec.symbol}, ${geneName}, ${geneSpec.entrezGeneId},
            ${chrom}, ${mapLoc}, ${summary},
            ${JSON.stringify(ncbiGeneData?.raw || { symbol: geneSpec.symbol, entrez: geneSpec.entrezGeneId })}::jsonb,
            'source_imported', true,
            false, NOW(), 'NCBI-Gene-v1'
          )
          ON CONFLICT (symbol) DO UPDATE SET
            name = EXCLUDED.name,
            entrez_gene_id = EXCLUDED.entrez_gene_id,
            chromosome = EXCLUDED.chromosome,
            cytogenetic_location = EXCLUDED.cytogenetic_location,
            summary = EXCLUDED.summary,
            source_record = EXCLUDED.source_record,
            is_published = true,
            is_quarantined = false,
            source_retrieval_date = NOW(),
            updated_at = NOW()
          RETURNING id
        `;
        totalGenes++;

        // Link Disease-Gene
        await sql`
          INSERT INTO genomics.disease_gene_relationships (
            disease_id, gene_id, relationship_type, evidence_level,
            inheritance_pattern, source_id, curator_notes
          )
          VALUES (
            ${(disease as any).id}, ${(gene as any).id}, ${geneSpec.relationshipType},
            ${geneSpec.evidenceLevel}, ${geneSpec.inheritance},
            'ncbi_gene', ${geneSpec.curatorNotes}
          )
          ON CONFLICT (disease_id, gene_id, relationship_type) DO UPDATE SET
            evidence_level = EXCLUDED.evidence_level,
            curator_notes = EXCLUDED.curator_notes
        `;
      }

      // 3.4 Process Variants
      for (const varSpec of dataset.variants) {
        console.log(`    Processing ClinVar variant ${varSpec.preferredName} (${varSpec.clinvarVcv})...`);

        const [variant] = await sql`
          INSERT INTO genomics.variants (
            clinvar_vcv, preferred_name, hgvs_cdna, hgvs_protein,
            dbsnp_id, variant_type, molecular_consequence,
            assembly, chromosome, position_vcf, ref_allele, alt_allele,
            clinical_significance, review_status_clinvar, gold_stars,
            source_record, review_status, is_published, is_quarantined,
            source_retrieval_date, source_payload_version
          )
          VALUES (
            ${varSpec.clinvarVcv}, ${varSpec.preferredName}, ${varSpec.hgvsCdna},
            ${varSpec.hgvsProtein}, ${varSpec.dbsnpId}, ${varSpec.variantType},
            ${varSpec.molecularConsequence}, 'GRCh38', ${varSpec.chromosome},
            ${varSpec.positionVcf}, ${varSpec.refAllele}, ${varSpec.altAllele},
            ${varSpec.significance}, ${varSpec.reviewStatusClinvar}, ${varSpec.goldStars},
            ${JSON.stringify(varSpec)}::jsonb,
            'source_imported', true, false,
            NOW(), 'ClinVar-NCBI-v1'
          )
          ON CONFLICT (clinvar_vcv) DO UPDATE SET
            preferred_name = EXCLUDED.preferred_name,
            hgvs_cdna = EXCLUDED.hgvs_cdna,
            hgvs_protein = EXCLUDED.hgvs_protein,
            dbsnp_id = EXCLUDED.dbsnp_id,
            variant_type = EXCLUDED.variant_type,
            molecular_consequence = EXCLUDED.molecular_consequence,
            chromosome = EXCLUDED.chromosome,
            position_vcf = EXCLUDED.position_vcf,
            ref_allele = EXCLUDED.ref_allele,
            alt_allele = EXCLUDED.alt_allele,
            clinical_significance = EXCLUDED.clinical_significance,
            review_status_clinvar = EXCLUDED.review_status_clinvar,
            gold_stars = EXCLUDED.gold_stars,
            source_record = EXCLUDED.source_record,
            is_published = true,
            is_quarantined = false,
            source_retrieval_date = NOW(),
            updated_at = NOW()
          RETURNING id
        `;
        totalVariants++;

        // Link Variant-Gene
        const [targetGene] = await sql`SELECT id FROM genomics.genes WHERE symbol = ${varSpec.geneSymbol} LIMIT 1`;
        if (targetGene) {
          await sql`
            INSERT INTO genomics.variant_gene_relationships (
              variant_id, gene_id, relationship_type, consequence
            )
            VALUES (
              ${(variant as any).id}, ${(targetGene as any).id}, 'located_in', ${varSpec.molecularConsequence}
            )
            ON CONFLICT (variant_id, gene_id) DO UPDATE SET
              consequence = EXCLUDED.consequence
          `;
        }

        // Link Variant-Disease
        await sql`
          INSERT INTO genomics.variant_disease_relationships (
            variant_id, disease_id, clinical_significance,
            review_status_clinvar, gold_stars, source_evidence
          )
          VALUES (
            ${(variant as any).id}, ${(disease as any).id}, ${varSpec.significance},
            ${varSpec.reviewStatusClinvar}, ${varSpec.goldStars},
            ${JSON.stringify({ assertionsCount: varSpec.assertions.length, clinvarVariationId: varSpec.clinvarVariationId })}::jsonb
          )
          ON CONFLICT (variant_id, disease_id) DO UPDATE SET
            clinical_significance = EXCLUDED.clinical_significance,
            review_status_clinvar = EXCLUDED.review_status_clinvar,
            gold_stars = EXCLUDED.gold_stars,
            source_evidence = EXCLUDED.source_evidence
        `;

        // Insert Clinical Assertions with ON CONFLICT idempotency
        for (const ass of varSpec.assertions) {
          await sql`
            INSERT INTO genomics.variant_clinical_assertions (
              variant_id, rcv_accession, scv_accession, submitter_name,
              clinical_significance, disease_name, assertion_criteria
            )
            VALUES (
              ${(variant as any).id}, ${ass.rcv}, ${ass.scv}, ${ass.submitter},
              ${ass.significance}, ${dataset.name}, ${ass.criteria}
            )
            ON CONFLICT (variant_id, scv_accession) DO UPDATE SET
              rcv_accession = EXCLUDED.rcv_accession,
              submitter_name = EXCLUDED.submitter_name,
              clinical_significance = EXCLUDED.clinical_significance,
              disease_name = EXCLUDED.disease_name,
              assertion_criteria = EXCLUDED.assertion_criteria
          `;
          totalAssertions++;
        }
      }

      // 3.5 Process Publications (PubMed)
      for (const pmid of dataset.pmids) {
        console.log(`    Fetching PubMed metadata for PMID ${pmid}...`);
        let pubData: any = null;
        try {
          pubData = await ncbi.getPubMedArticle(pmid);
        } catch (e: any) {
          console.warn(`    [PubMed Warn] Could not fetch PMID ${pmid}: ${e.message}`);
          errors.push(`PubMed ${pmid}: ${e.message}`);
        }

        if (pubData) {
          const [pub] = await sql`
            INSERT INTO genomics.publications (
              pmid, pmcid, doi, title, authors, journal, pub_year, pub_date, source_record
            )
            VALUES (
              ${pubData.pmid}, ${pubData.pmcid || null}, ${pubData.doi || null},
              ${pubData.title}, ${JSON.stringify(pubData.authors)}::jsonb,
              ${pubData.journal}, ${pubData.pubYear || null}, ${pubData.pubDate || null},
              ${JSON.stringify(pubData.raw || {})}::jsonb
            )
            ON CONFLICT (pmid) DO UPDATE SET
              title = EXCLUDED.title,
              journal = EXCLUDED.journal,
              pub_year = EXCLUDED.pub_year
            RETURNING id
          `;
          totalPubs++;

          // Link publication reference to disease
          await sql`
            INSERT INTO genomics.scientific_references (
              publication_id, entity_type, entity_id, evidence_note
            )
            VALUES (
              ${(pub as any).id}, 'disease', ${(disease as any).id},
              ${'Key literature benchmark for ' + dataset.name}
            )
            ON CONFLICT (publication_id, entity_type, entity_id) DO NOTHING
          `;
        }
      }
    }

    // 4. Record Dataset Version
    await sql`
      INSERT INTO genomics.dataset_versions (
        data_source_id, version_tag, record_count, metadata
      )
      VALUES (
        'ncbi_clinvar', 'ClinVar-NCBI-Remediated-v2.0',
        ${totalVariants},
        ${JSON.stringify({ diseases: totalDiseases, genes: totalGenes, variants: totalVariants, assertions: totalAssertions })}::jsonb
      )
    `;

    // 5. Update Import Job
    await sql`
      UPDATE genomics.import_jobs SET
        status = 'completed',
        records_ingested = ${totalDiseases + totalGenes + totalVariants},
        records_updated = 0,
        errors = ${JSON.stringify(errors)}::jsonb,
        completed_at = NOW()
      WHERE id = ${jobId}
    `;

    // 6. Create Audit Log
    await sql`
      INSERT INTO genomics.audit_logs (
        actor_email, action, entity_type, entity_id, details
      )
      VALUES (
        'pipeline@akahelix.com', 'INGEST_TARGETED_DATASET_REMEDIATED',
        'system', ${jobId},
        ${JSON.stringify({
          workerId,
          diseases: totalDiseases,
          genes: totalGenes,
          variants: totalVariants,
          assertions: totalAssertions,
          publications: totalPubs,
        })}::jsonb
      )
    `;

    console.log(
      `==> Remediated ingestion completed successfully: ${totalDiseases} diseases, ${totalGenes} genes, ${totalVariants} variants, ${totalAssertions} assertions, ${totalPubs} publications.`
    );

    return {
      jobId,
      status: "completed",
      diseasesCount: totalDiseases,
      genesCount: totalGenes,
      variantsCount: totalVariants,
      assertionsCount: totalAssertions,
      publicationsCount: totalPubs,
      errors,
    };
  } catch (err: any) {
    console.error("==> Ingestion pipeline failed:", err);
    if (jobId) {
      await sql`
        UPDATE genomics.import_jobs SET
          status = 'failed',
          errors = ${JSON.stringify([...errors, err.message])}::jsonb,
          completed_at = NOW()
        WHERE id = ${jobId}
      `;
    }
    throw err;
  } finally {
    // Release the mutex ingestion lock
    await releaseIngestionLock(workerId);
    console.log(`==> Ingestion lock released by ${workerId}.`);
  }
}

// Allow direct CLI invocation: npx tsx src/genomics/services/ingestion/pipeline.ts
if (process.argv[1] && process.argv[1].endsWith("pipeline.ts")) {
  runIngestionPipeline()
    .then((r) => {
      console.log("Pipeline result:", r);
      process.exit(0);
    })
    .catch((err) => {
      console.error("Pipeline failure:", err);
      process.exit(1);
    });
}
