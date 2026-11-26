import React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, ArrowRight } from "@phosphor-icons/react";

import { GenomicsHeader } from "@/genomics/components/GenomicsHeader";
import { GenomicsSearchInput } from "@/genomics/components/GenomicsSearchInput";
import { GenomicsVisualizations } from "@/genomics/components/GenomicsVisualizations";
import { ResearchUseDisclaimer } from "@/genomics/components/GenomicsBadges";
import { getGenomicsOverviewFn, getGenomicsAnalyticsFn } from "@/genomics/functions";
import { Chip, SectionLabel } from "@/components/site/Section";
import { FadeUp, RevealText } from "@/components/site/motion";

export const Route = createFileRoute("/genomics/")({
  loader: async () => {
    const [stats, analytics] = await Promise.all([
      getGenomicsOverviewFn(),
      getGenomicsAnalyticsFn(),
    ]);
    return { stats, analytics };
  },
  head: () => ({
    meta: [
      { title: "Genomics Research Database · Clinical Curation & Target Repository · AKAHELIX" },
      {
        name: "description",
        content:
          "Authoritative clinical genomics knowledge base covering molecular genetics, ClinVar variant assertions, disease-gene causality, and ACMG-guided curation for laboratory diagnostic development.",
      },
      { property: "og:title", content: "Genomics Research Database · AKAHELIX" },
      {
        property: "og:description",
        content:
          "Curated clinical genetics database for diagnostic laboratories, LDT assay validation, and molecular pathology research.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://www.akahelix.com/genomics" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://www.akahelix.com/genomics" }],
  }),
  component: GenomicsIndexPage,
});

function GenomicsIndexPage() {
  const { stats, analytics } = Route.useLoaderData();

  const coreDiseases = [
    {
      index: "01",
      slug: "beta-thalassemia",
      name: "Beta-thalassemia",
      inheritance: "Autosomal recessive",
      genes: ["HBB"],
      omim: "613985",
      desc: "Impaired synthesis of adult hemoglobin beta chain, leading to microcytic hypochromic anemia and ineffective erythropoiesis.",
    },
    {
      index: "02",
      slug: "alpha-thalassemia",
      name: "Alpha-thalassemia",
      inheritance: "Autosomal recessive",
      genes: ["HBA1", "HBA2"],
      omim: "604131",
      desc: "Reduced production of alpha-globin chains resulting in HbH disease or fatal Hb Barts hydrops fetalis.",
    },
    {
      index: "03",
      slug: "sickle-cell-disease",
      name: "Sickle Cell Disease",
      inheritance: "Autosomal recessive",
      genes: ["HBB"],
      omim: "603903",
      desc: "Homozygous or compound heterozygous HBB p.Glu7Val substitution causing HbS polymerization, vaso-occlusion, and hemolysis.",
    },
    {
      index: "04",
      slug: "spinal-muscular-atrophy",
      name: "Spinal Muscular Atrophy",
      inheritance: "Autosomal recessive",
      genes: ["SMN1", "SMN2"],
      omim: "253300",
      desc: "Degeneration of lower motor neurons primarily driven by biallelic SMN1 deletion or loss-of-function variants.",
    },
    {
      index: "05",
      slug: "cystic-fibrosis",
      name: "Cystic Fibrosis",
      inheritance: "Autosomal recessive",
      genes: ["CFTR"],
      omim: "219700",
      desc: "Multisystem disorder of epithelial ion transport causing chronic obstructive pulmonary disease and exocrine pancreatic insufficiency.",
    },
    {
      index: "06",
      slug: "hereditary-breast-and-ovarian-cancer-brca1",
      name: "BRCA1 Hereditary Cancer",
      inheritance: "Autosomal dominant",
      genes: ["BRCA1"],
      omim: "604370",
      desc: "Germline DNA double-strand break repair deficiency predisposing to early-onset breast, ovarian, and related epithelial malignancies.",
    },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Sub-navigation bar under fixed header */}
      <GenomicsHeader />

      {/* Hero Section */}
      <section className="container-x pb-10 pt-10 md:pb-14 md:pt-12">
        <div className="max-w-4xl">
          <Chip className="mb-5">Genomics Research Repository · GRCh38 · RUO</Chip>

          <h1 className="display-lg tracking-tight max-w-[20ch]">
            Molecular Genetics & Reference Curation Repository
          </h1>

          <p className="lede text-muted-foreground mt-4 max-w-[65ch]">
            Structured research knowledge base linking human disease phenotypes, causative loci, ClinVar assertions, and peer-reviewed literature with separated source provenance and scientist review status.
          </p>

          <div className="mt-8 max-w-3xl">
            <GenomicsSearchInput />
          </div>
        </div>
      </section>

      {/* Metric Strip: Architectural Border-Grid */}
      <section className="border-y border-border py-8 md:py-12 bg-mist/20">
        <div className="container-x">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 border border-border bg-paper divide-x divide-y sm:divide-y-0 divide-border">
            <div className="p-6 md:p-8">
              <span className="label-mono text-muted-foreground block">01 / Diseases</span>
              <span className="numeral text-4xl md:text-5xl text-foreground block mt-3">
                {String(stats?.diseasesCount || 0).padStart(2, "0")}
              </span>
              <span className="label-mono text-[10px] text-muted-foreground mt-3 block">
                Targeted Phenotypes
              </span>
            </div>

            <div className="p-6 md:p-8">
              <span className="label-mono text-muted-foreground block">02 / Genes</span>
              <span className="numeral text-4xl md:text-5xl text-foreground block mt-3">
                {String(stats?.genesCount || 0).padStart(2, "0")}
              </span>
              <span className="label-mono text-[10px] text-muted-foreground mt-3 block">
                NCBI & HGNC Loci
              </span>
            </div>

            <div className="p-6 md:p-8">
              <span className="label-mono text-muted-foreground block">03 / Variants</span>
              <span className="numeral text-4xl md:text-5xl text-foreground block mt-3">
                {String(stats?.variantsCount || 0).padStart(2, "0")}
              </span>
              <span className="label-mono text-[10px] text-muted-foreground mt-3 block">
                ClinVar VCVs
              </span>
            </div>

            <div className="p-6 md:p-8">
              <span className="label-mono text-muted-foreground block">04 / Assertions</span>
              <span className="numeral text-4xl md:text-5xl text-foreground block mt-3">
                {String(stats?.assertionsCount || 0).padStart(2, "0")}
              </span>
              <span className="label-mono text-[10px] text-muted-foreground mt-3 block">
                RCV & SCV Evidence
              </span>
            </div>

            <div className="p-6 md:p-8">
              <span className="label-mono text-muted-foreground block">05 / Citations</span>
              <span className="numeral text-4xl md:text-5xl text-foreground block mt-3">
                {String(stats?.publicationsCount || 0).padStart(2, "0")}
              </span>
              <span className="label-mono text-[10px] text-muted-foreground mt-3 block">
                PubMed References
              </span>
            </div>

            <div className="p-6 md:p-8">
              <span className="label-mono text-muted-foreground block">06 / Sources</span>
              <span className="numeral text-4xl md:text-5xl text-blue block mt-3">
                {String(stats?.sourcesCount || 0).padStart(2, "0")}
              </span>
              <span className="label-mono text-[10px] text-muted-foreground mt-3 block">
                Integrated Feeds
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Core Diagnostic Panels */}
      <section className="container-x py-12 md:py-16">
        <SectionLabel n="01">Core reference panels</SectionLabel>

        <div className="grid-12 mb-8 gap-y-4">
          <div className="col-span-12 md:col-span-8">
            <h2 className="display-md">
              Targeted molecular genetics panels for research reference.
            </h2>
          </div>
          <div className="col-span-12 md:col-span-4 flex items-end md:justify-end">
            <Link
              to="/genomics/diseases"
              className="label-mono text-blue hover:underline inline-flex items-center gap-1.5"
            >
              <span>Full Disease Index</span>
              <ArrowRight size={13} />
            </Link>
          </div>
        </div>

        {/* 3x2 Monograph Grid with 1px hairline separators */}
        <div className="grid gap-px border border-border bg-rule sm:grid-cols-2 lg:grid-cols-3">
          {coreDiseases.map((disease) => (
            <div
              key={disease.slug}
              className="bg-paper flex flex-col justify-between p-8 md:p-10 transition-colors hover:bg-mist/30 group"
            >
              <div>
                <div className="flex items-center justify-between label-mono text-muted-foreground">
                  <span>P—{disease.index}</span>
                  <span className="text-blue">{disease.inheritance}</span>
                </div>

                <h3 className="font-display text-2xl tracking-tight mt-6 text-foreground group-hover:text-blue transition-colors">
                  <Link
                    to="/genomics/diseases/$id"
                    params={{ id: disease.slug }}
                  >
                    {disease.name}
                  </Link>
                </h3>

                <p className="mt-4 text-sm text-muted-foreground leading-relaxed font-sans line-clamp-3">
                  {disease.desc}
                </p>
              </div>

              <div className="mt-8 pt-6 border-t border-border flex items-center justify-between">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="label-mono text-[10px] text-muted-foreground">Loci:</span>
                  {disease.genes.map((g) => (
                    <Link
                      key={g}
                      to="/genomics/genes/$id"
                      params={{ id: g }}
                      className="label-mono text-[11px] font-semibold text-foreground bg-mist border border-border px-1.5 py-0.5 rounded-[2px] hover:border-foreground transition-colors"
                    >
                      {g}
                    </Link>
                  ))}
                </div>

                <Link
                  to="/genomics/diseases/$id"
                  params={{ id: disease.slug }}
                  className="label-mono text-[11px] text-blue inline-flex items-center gap-1 hover:underline"
                >
                  <span>Dossier</span>
                  <ArrowUpRight size={12} />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Scientific Analytics, Relationship Graph & Provenance */}
      <section className="container-x pb-20 md:pb-28">
        <SectionLabel n="02">Analytics, Relationships & Provenance</SectionLabel>
        <div className="mb-10">
          <h2 className="display-md">
            Relational causality, genomic distribution, and source provenance.
          </h2>
        </div>
        <GenomicsVisualizations analytics={analytics} />
      </section>

      {/* Governance & Provenance Section */}
      <section className="bg-mist/40 border-t border-border py-12 md:py-16">
        <div className="container-x">
          <SectionLabel n="03">Governance & Provenance</SectionLabel>

          <div className="grid-12 gap-y-8">
            <div className="col-span-12 md:col-span-4">
              <span className="label-mono text-muted-foreground">G—01 / Architecture</span>
              <h3 className="font-display text-xl tracking-tight mt-3 text-foreground">
                Authoritative Provenance
              </h3>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed font-sans">
                Ingested from NCBI Gene, ClinVar, MedGen, PubMed, HGNC, and HPO using rate-limited APIs. Original source payloads and sync dates are preserved separately from scientist curation.
              </p>
            </div>

            <div className="col-span-12 md:col-span-4">
              <span className="label-mono text-muted-foreground">G—02 / Guidelines</span>
              <h3 className="font-display text-xl tracking-tight mt-3 text-foreground">
                ACMG/AMP Framework
              </h3>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed font-sans">
                Variant classifications reflect ClinVar submitted assertions (SCVs), reference records (RCVs), and ClinGen expert panel specifications. Incomplete evidence is explicitly labeled.
              </p>
            </div>

            <div className="col-span-12 md:col-span-4">
              <span className="label-mono text-muted-foreground">G—03 / Curation Status</span>
              <h3 className="font-display text-xl tracking-tight mt-3 text-foreground">
                Imported vs. Approved Separation
              </h3>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed font-sans">
                Automated imports are never automatically approved. Each record displays its review status, and unsupported or mismatched entries remain quarantined from public views.
              </p>
            </div>
          </div>

          <ResearchUseDisclaimer />
        </div>
      </section>
    </div>
  );
}
