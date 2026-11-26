import React from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowSquareOut,
  ArrowUpRight,
  MagnifyingGlass,
} from "@phosphor-icons/react";

import { GenomicsHeader } from "@/genomics/components/GenomicsHeader";
import { GenomicsBreadcrumbs } from "@/genomics/components/GenomicsBreadcrumbs";
import { GenomicsDataTable, type ColumnDef } from "@/genomics/components/GenomicsDataTable";
import { getResearchPublicationsFn } from "@/genomics/functions";
import { Chip, SectionLabel } from "@/components/site/Section";

interface ResearchSearchParams {
  page?: number | undefined;
  search?: string | undefined;
}

export const Route = createFileRoute("/genomics/research")({
  validateSearch: (search: Record<string, unknown>): ResearchSearchParams => {
    return {
      page: typeof search["page"] === "number" ? search["page"] : 1,
      search: typeof search["search"] === "string" ? search["search"] : undefined,
    };
  },
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    return await getResearchPublicationsFn({
      data: {
        page: deps.page || 1,
        limit: 20,
        search: deps.search,
      },
    });
  },
  head: () => ({
    meta: [
      { title: "Genomics Research & Literature · Benchmark Evidence · AKAHELIX" },
      {
        name: "description",
        content:
          "Authoritative scientific references, PubMed literature index, and biomedical data provenance powering the AKAHELIX clinical genomics repository.",
      },
    ],
  }),
  component: ResearchPage,
});

function ResearchPage() {
  const search = Route.useSearch();
  const data = Route.useLoaderData();
  const navigate = useNavigate();

  const handlePageChange = (newPage: number) => {
    navigate({
      to: "/genomics/research",
      search: { ...search, page: newPage },
    });
  };

  const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const q = (formData.get("q") as string) || undefined;
    navigate({
      to: "/genomics/research",
      search: { ...search, search: q, page: 1 },
    });
  };

  const dataSources = [
    {
      id: "ncbi_gene",
      name: "NCBI Gene",
      authority: "National Center for Biotechnology Information (NLM/NIH)",
      license: "Public Domain",
      url: "https://www.ncbi.nlm.nih.gov/gene/",
      desc: "Gene-specific information including chromosomal nomenclature, genomic coordinates (GRCh38), RefSeq transcripts, and functional summaries.",
    },
    {
      id: "ncbi_clinvar",
      name: "NCBI ClinVar",
      authority: "National Center for Biotechnology Information (NLM/NIH)",
      license: "Public Domain",
      url: "https://www.ncbi.nlm.nih.gov/clinvar/",
      desc: "Public archive of relationships between human variants and phenotypes, submitter clinical assertions (SCVs), and reference interpretations (RCVs).",
    },
    {
      id: "ncbi_medgen",
      name: "NCBI MedGen",
      authority: "National Center for Biotechnology Information (NLM/NIH)",
      license: "Public Domain / UMLS",
      url: "https://www.ncbi.nlm.nih.gov/medgen/",
      desc: "Organizes information related to human medical genetics including concept identifiers (CUI), clinical manifestations, and OMIM/Orphanet mapping.",
    },
    {
      id: "ncbi_pubmed",
      name: "NCBI PubMed",
      authority: "National Library of Medicine (NLM/NIH)",
      license: "Open Access Metadata",
      url: "https://pubmed.ncbi.nlm.nih.gov/",
      desc: "Biomedical literature citations and abstracts providing primary peer-reviewed clinical validation evidence.",
    },
    {
      id: "clingen",
      name: "Clinical Genome Resource (ClinGen)",
      authority: "ClinGen Consortium (NIH)",
      license: "CC-BY 4.0",
      url: "https://clinicalgenome.org/",
      desc: "Expert panel gene-disease validity curations and variant pathogenicity specifications.",
    },
    {
      id: "omim",
      name: "Online Mendelian Inheritance in Man (OMIM)",
      authority: "Johns Hopkins University",
      license: "Academic / Research",
      url: "https://omim.org/",
      desc: "Compendium of human genes and genetic phenotypes cataloging Mendelian inheritance mechanisms.",
    },
  ];

  const columns: ColumnDef<any>[] = [
    {
      key: "pmid",
      header: "PMID",
      render: (p) => (
        <a
          href={`https://pubmed.ncbi.nlm.nih.gov/${p.pmid}/`}
          target="_blank"
          rel="noreferrer"
          className="label-mono font-bold text-blue hover:underline inline-flex items-center gap-1 text-xs"
        >
          {p.pmid} <ArrowSquareOut size={11} />
        </a>
      ),
    },
    {
      key: "title",
      header: "Article Title",
      render: (p) => (
        <div>
          <a
            href={`https://pubmed.ncbi.nlm.nih.gov/${p.pmid}/`}
            target="_blank"
            rel="noreferrer"
            className="text-xs sm:text-sm font-medium text-foreground hover:text-blue transition-colors leading-snug line-clamp-2"
          >
            {p.title || `PubMed Article PMID: ${p.pmid}`}
          </a>
          {p.doi && (
            <div className="text-[10px] label-mono text-muted-foreground mt-0.5">
              DOI: {p.doi}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "journal",
      header: "Journal",
      render: (p) => (
        <span className="text-xs font-mono text-muted-foreground">
          {p.journal || "PubMed Central"}
        </span>
      ),
    },
    {
      key: "year",
      header: "Year",
      align: "center",
      render: (p) => (
        <span className="label-mono text-[11px] px-2 py-0.5 bg-mist border border-border text-foreground rounded-[2px]">
          {p.pub_year || "—"}
        </span>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <GenomicsHeader />

      <main className="container-x py-10 md:py-16">
        <GenomicsBreadcrumbs items={[{ label: "Literature & Evidence" }]} />

        {/* Hero */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-12 border-b border-border pb-8">
          <div>
            <Chip className="mb-4">Evidence & Attribution Registry</Chip>
            <h1 className="display-lg tracking-tight">Scientific Literature & Data Provenance</h1>
            <p className="lede text-muted-foreground mt-4 max-w-[65ch]">
              Peer-reviewed biomedical literature, guidelines from ACMG/AMP and ClinGen, and authoritative database attributions backing the AKAHELIX genomics knowledge base.
            </p>
          </div>
        </div>

        {/* Literature Table Section */}
        <section className="mb-20">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
            <SectionLabel n="01">Indexed PubMed Publications ({data.total})</SectionLabel>

            <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-64 mb-6 sm:mb-0">
              <MagnifyingGlass size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                name="q"
                defaultValue={search.search || ""}
                placeholder="Search publications..."
                className="w-full pl-8 pr-3 py-2 text-xs font-mono border border-border rounded-[3px] bg-paper text-foreground placeholder:text-muted-foreground outline-none focus:border-blue transition-colors"
              />
            </form>
          </div>

          <GenomicsDataTable
            columns={columns}
            data={data.items}
            total={data.total}
            page={data.page}
            pageSize={data.limit}
            onPageChange={handlePageChange}
            keyExtractor={(item) => (item as any).id}
            emptyMessage="No publications found matching your search query."
          />
        </section>

        {/* Data Sources & Licensing Section */}
        <section className="mb-20">
          <SectionLabel n="02">Authoritative Data Sources & Provenance</SectionLabel>

          <div className="grid gap-px border border-border bg-rule sm:grid-cols-2 lg:grid-cols-3">
            {dataSources.map((ds) => (
              <div
                key={ds.id}
                className="bg-paper p-8 flex flex-col justify-between hover:bg-mist/30 transition-colors"
              >
                <div>
                  <div className="flex items-center justify-between text-xs label-mono text-muted-foreground mb-3">
                    <span className="font-semibold text-foreground">{ds.name}</span>
                    <span className="px-2 py-0.5 bg-mist border border-border rounded-[2px] text-[10px] text-foreground">
                      {ds.license}
                    </span>
                  </div>
                  <div className="text-xs font-medium text-foreground/80 mb-3">{ds.authority}</div>
                  <p className="text-xs text-muted-foreground font-sans leading-relaxed line-clamp-4">
                    {ds.desc}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-border text-right">
                  <a
                    href={ds.url}
                    target="_blank"
                    rel="noreferrer"
                    className="label-mono text-[11px] text-blue hover:underline inline-flex items-center gap-1"
                  >
                    <span>Source Homepage</span>
                    <ArrowUpRight size={11} />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Curation Governance Box */}
        <div className="border border-border bg-mist/30 p-8 rounded-[3px]">
          <div className="label-mono text-xs text-foreground font-semibold mb-2">
            AKAHELIX SCIENTIFIC CURATION & PEER AUDIT PROTOCOL
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed font-sans max-w-4xl">
            Every clinical assertion, variant interpretation, and disease-gene association in the AKAHELIX Genomics Database undergoes scientific review prior to publication. Clinical laboratory directors and molecular pathologists verify entries against ACMG/AMP consensus guidelines and NYSDOH Wadsworth Center validation requirements.
          </p>
        </div>
      </main>
    </div>
  );
}
