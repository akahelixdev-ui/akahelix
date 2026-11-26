import React from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowUpRight, DownloadSimple } from "@phosphor-icons/react";

import { GenomicsHeader } from "@/genomics/components/GenomicsHeader";
import { GenomicsBreadcrumbs } from "@/genomics/components/GenomicsBreadcrumbs";
import { GenomicsSearchInput } from "@/genomics/components/GenomicsSearchInput";
import { PathogenicityBadge, ClinVarStarsBadge, InheritanceBadge, ResearchUseDisclaimer } from "@/genomics/components/GenomicsBadges";
import { searchGenomicsFn } from "@/genomics/functions";
import type { SearchCategory } from "@/genomics/db/client";
import { Chip, SectionLabel } from "@/components/site/Section";

interface SearchParams {
  q?: string | undefined;
  category?: SearchCategory | undefined;
  significance?: string | undefined;
  chromosome?: string | undefined;
  inheritance?: string | undefined;
  evidenceLevel?: string | undefined;
  reviewStatus?: string | undefined;
}

const VALID_CATEGORIES: SearchCategory[] = [
  "all",
  "diseases",
  "genes",
  "variants",
  "phenotypes",
  "publications",
];

export const Route = createFileRoute("/genomics/search")({
  validateSearch: (search: Record<string, unknown>): SearchParams => {
    const rawCat = typeof search["category"] === "string" ? search["category"] : "all";
    return {
      q: typeof search["q"] === "string" ? search["q"] : "",
      category: VALID_CATEGORIES.includes(rawCat as SearchCategory)
        ? (rawCat as SearchCategory)
        : "all",
      significance: typeof search["significance"] === "string" && search["significance"] ? search["significance"] : undefined,
      chromosome: typeof search["chromosome"] === "string" && search["chromosome"] ? search["chromosome"] : undefined,
      inheritance: typeof search["inheritance"] === "string" && search["inheritance"] ? search["inheritance"] : undefined,
      evidenceLevel: typeof search["evidenceLevel"] === "string" && search["evidenceLevel"] ? search["evidenceLevel"] : undefined,
      reviewStatus: typeof search["reviewStatus"] === "string" && search["reviewStatus"] ? search["reviewStatus"] : undefined,
    };
  },
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    const q = (deps.q || "").trim();
    const hasFilter = !!(
      deps.significance ||
      deps.chromosome ||
      deps.inheritance ||
      deps.evidenceLevel ||
      deps.reviewStatus ||
      (deps.category && deps.category !== "all")
    );

    if (!q && !hasFilter) {
      // Load facets even on initial empty search page
      return await searchGenomicsFn({
        data: {
          q: "",
          category: "all",
          limit: 10,
        },
      });
    }

    return await searchGenomicsFn({
      data: {
        q,
        category: deps.category || "all",
        significance: deps.significance,
        chromosome: deps.chromosome,
        inheritance: deps.inheritance,
        evidenceLevel: deps.evidenceLevel,
        reviewStatus: deps.reviewStatus,
      },
    });
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData?.query
          ? `Search Results for "${loaderData.query}" · AKAHELIX Genomics`
          : "Genomics Search & Query · AKAHELIX",
      },
      {
        name: "description",
        content:
          "Search human genetic diseases, causative genes, ClinVar variants, HGVS coordinates, and clinical assertions in the AKAHELIX Genomics Database.",
      },
    ],
  }),
  component: GenomicsSearchPage,
});

function GenomicsSearchPage() {
  const search = Route.useSearch();
  const searchResult: any = Route.useLoaderData();
  const navigate = useNavigate();

  const updateFilter = (patch: Partial<SearchParams>) => {
    navigate({
      to: "/genomics/search",
      search: { ...search, ...patch },
    });
  };

  const buildExportUrl = (format: "csv" | "json") => {
    const params = new URLSearchParams();
    params.set("action", "export");
    params.set("format", format);
    if (search.category) params.set("entity", search.category);
    if (search.q) params.set("q", search.q);
    if (search.chromosome) params.set("chromosome", search.chromosome);
    if (search.inheritance) params.set("inheritance", search.inheritance);
    if (search.significance) params.set("significance", search.significance);
    if (search.evidenceLevel) params.set("evidenceLevel", search.evidenceLevel);
    if (search.reviewStatus) params.set("reviewStatus", search.reviewStatus);
    return `/api/genomics?${params.toString()}`;
  };

  const facets = searchResult?.facets || {
    chromosomes: [],
    inheritances: [],
    significances: [],
    evidenceLevels: [],
    reviewStatuses: ["approved", "pending_review"],
  };

  const phenotypes = searchResult?.phenotypes || [];
  const publications = searchResult?.publications || [];
  const hasActiveQueryOrFilter = !!(
    search.q?.trim() ||
    search.chromosome ||
    search.inheritance ||
    search.significance ||
    search.evidenceLevel ||
    search.reviewStatus ||
    (search.category && search.category !== "all")
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <GenomicsHeader />

      <main className="container-x py-8 md:py-10">
        <GenomicsBreadcrumbs items={[{ label: "Search & Query" }]} />

        {/* Search Bar Container */}
        <div className="border border-border bg-paper rounded-[3px] p-8 md:p-12 mb-8">
          <Chip className="mb-4">Unified Discovery Query</Chip>
          <h1 className="display-lg tracking-tight mb-4">Genomics Knowledge Base Query</h1>
          <p className="lede text-muted-foreground mb-8 max-w-[65ch]">
            Search across diseases, genes, ClinVar VCV accessions, HGVS coordinates, dbSNP rsIDs, HPO phenotypes, and PubMed literature.
          </p>
          <GenomicsSearchInput
            initialQuery={search.q || ""}
            initialCategory={
              search.category === "diseases" || search.category === "genes" || search.category === "variants"
                ? search.category
                : "all"
            }
            autoFocus={!search.q}
          />
        </div>

        {/* Category Tabs & Multi-Facet Filters */}
        <div className="mb-10 pb-6 border-b border-border space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Category Tabs */}
            <div className="flex items-center flex-wrap gap-1 border border-border bg-paper p-1 rounded-[3px]">
              {(
                [
                  { id: "all", label: `All (${searchResult.total || 0})` },
                  { id: "diseases", label: `Diseases (${searchResult.diseases?.length || 0})` },
                  { id: "genes", label: `Genes (${searchResult.genes?.length || 0})` },
                  { id: "variants", label: `Variants (${searchResult.variants?.length || 0})` },
                  { id: "phenotypes", label: `Phenotypes (${phenotypes.length})` },
                  { id: "publications", label: `Publications (${publications.length})` },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => updateFilter({ category: tab.id })}
                  className={`px-3 py-1.5 label-mono text-[11px] uppercase rounded-[2px] transition-colors ${
                    (search.category || "all") === tab.id
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Public Export Buttons */}
            <div className="flex items-center gap-2">
              <a
                href={buildExportUrl("csv")}
                className="px-3 py-1.5 border border-border bg-paper hover:border-foreground rounded-[2px] label-mono text-[11px] inline-flex items-center gap-1.5 transition-colors"
              >
                <DownloadSimple size={12} />
                <span>Export CSV</span>
              </a>
              <a
                href={buildExportUrl("json")}
                className="px-3 py-1.5 border border-border bg-paper hover:border-foreground rounded-[2px] label-mono text-[11px] inline-flex items-center gap-1.5 transition-colors"
              >
                <DownloadSimple size={12} />
                <span>Export JSON</span>
              </a>
            </div>
          </div>

          {/* Structured Filter Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <select
              aria-label="Filter by Chromosome"
              value={search.chromosome || ""}
              onChange={(e) => updateFilter({ chromosome: e.target.value || undefined })}
              className="px-3 py-2 border border-border bg-paper rounded-[2px] text-xs font-mono text-foreground"
            >
              <option value="">All Chromosomes</option>
              {facets.chromosomes.map((c: string) => (
                <option key={c} value={c}>
                  Chromosome {c}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter by Inheritance Pattern"
              value={search.inheritance || ""}
              onChange={(e) => updateFilter({ inheritance: e.target.value || undefined })}
              className="px-3 py-2 border border-border bg-paper rounded-[2px] text-xs font-mono text-foreground"
            >
              <option value="">All Inheritance Modes</option>
              {facets.inheritances.map((inh: string) => (
                <option key={inh} value={inh}>
                  {inh}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter by Clinical Significance"
              value={search.significance || ""}
              onChange={(e) => updateFilter({ significance: e.target.value || undefined })}
              className="px-3 py-2 border border-border bg-paper rounded-[2px] text-xs font-mono text-foreground"
            >
              <option value="">All Clinical Significances</option>
              {facets.significances.map((sig: string) => (
                <option key={sig} value={sig}>
                  {sig}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter by Evidence Level"
              value={search.evidenceLevel || ""}
              onChange={(e) => updateFilter({ evidenceLevel: e.target.value || undefined })}
              className="px-3 py-2 border border-border bg-paper rounded-[2px] text-xs font-mono text-foreground"
            >
              <option value="">All Evidence Levels</option>
              {facets.evidenceLevels.map((ev: string) => (
                <option key={ev} value={ev}>
                  {ev}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter by Review Status"
              value={search.reviewStatus || ""}
              onChange={(e) => updateFilter({ reviewStatus: e.target.value || undefined })}
              className="px-3 py-2 border border-border bg-paper rounded-[2px] text-xs font-mono text-foreground"
            >
              <option value="">All Review Statuses</option>
              {facets.reviewStatuses.map((rs: string) => (
                <option key={rs} value={rs}>
                  {rs === "approved" ? "Scientist-Approved" : "Pending Review"}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Results Area */}
        {!hasActiveQueryOrFilter && searchResult.total === 0 ? (
          <div className="border border-border bg-paper rounded-[3px] p-16 text-center">
            <span className="label-mono text-muted-foreground text-[10px] uppercase block mb-3">
              Biomedical Query Engine
            </span>
            <h2 className="font-display text-2xl text-foreground mb-3">
              Ready to Query Knowledge Base
            </h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Type a gene symbol like <span className="label-mono text-foreground font-semibold">HBB</span>, condition like{" "}
              <span className="label-mono text-foreground font-semibold">Sickle cell</span>, ClinVar identifier like{" "}
              <span className="label-mono text-foreground font-semibold">VCV000015408</span>, HPO term, or PMID above.
            </p>
          </div>
        ) : searchResult.total === 0 ? (
          <div className="border border-border bg-paper rounded-[3px] p-16 text-center">
            <span className="label-mono text-muted-foreground text-[10px] uppercase block mb-3">
              0 Matches Found
            </span>
            <h2 className="font-display text-2xl text-foreground mb-3">
              No scientific records matched "{search.q}"
            </h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Try searching with standard HGVS cDNA notation, official HGNC gene symbols (e.g., CFTR, BRCA1, SMN1), or ClinVar VCV accessions.
            </p>
          </div>
        ) : (
          <div className="space-y-16">
            {/* 1. Diseases Section */}
            {(search.category === "all" || search.category === "diseases") &&
              searchResult.diseases.length > 0 && (
                <section>
                  <SectionLabel n="01">Diseases ({searchResult.diseases.length})</SectionLabel>
                  <div className="grid gap-px border border-border bg-rule sm:grid-cols-2">
                    {searchResult.diseases.map((d: any) => (
                      <div
                        key={d.id}
                        className="bg-paper p-8 flex flex-col justify-between hover:bg-mist/30 transition-colors"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <Link
                              to="/genomics/diseases/$id"
                              params={{ id: d.slug }}
                              className="font-display text-2xl font-normal text-foreground hover:text-blue transition-colors"
                            >
                              {d.name}
                            </Link>
                            <InheritanceBadge mode={d.inheritance_mode} />
                          </div>

                          <div className="flex items-center gap-3 text-[11px] label-mono text-muted-foreground mb-3">
                            {d.omim_id && <span>OMIM: {d.omim_id}</span>}
                            {d.concept_id && <span>MedGen: {d.concept_id}</span>}
                          </div>

                          {d.definition && (
                            <p className="mt-3 text-xs text-muted-foreground line-clamp-3 font-sans">
                              {d.definition}
                            </p>
                          )}
                        </div>

                        <div className="mt-6 pt-4 border-t border-border text-right">
                          <Link
                            to="/genomics/diseases/$id"
                            params={{ id: d.slug }}
                            className="label-mono text-[11px] text-blue hover:underline inline-flex items-center gap-1"
                          >
                            <span>View Profile</span>
                            <ArrowUpRight size={11} />
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

            {/* 2. Genes Section */}
            {(search.category === "all" || search.category === "genes") &&
              searchResult.genes.length > 0 && (
                <section>
                  <SectionLabel n="02">Genes ({searchResult.genes.length})</SectionLabel>
                  <div className="grid gap-px border border-border bg-rule sm:grid-cols-2">
                    {searchResult.genes.map((g: any) => (
                      <div
                        key={g.id}
                        className="bg-paper p-8 flex flex-col justify-between hover:bg-mist/30 transition-colors"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <Link
                              to="/genomics/genes/$id"
                              params={{ id: g.symbol }}
                              className="font-display text-2xl font-normal text-foreground hover:text-blue transition-colors"
                            >
                              {g.symbol}
                            </Link>
                            <span className="label-mono text-[10px] bg-mist border border-border px-2 py-0.5 rounded-[2px] text-muted-foreground">
                              Chr {g.chromosome}:{g.cytoband || "q"}
                            </span>
                          </div>

                          <div className="text-sm text-muted-foreground font-sans">{g.name}</div>

                          <div className="text-[11px] label-mono text-muted-foreground mt-3">
                            Entrez ID: {g.entrez_gene_id} {g.hgnc_id && `· HGNC: ${g.hgnc_id}`}
                          </div>
                        </div>

                        <div className="mt-6 pt-4 border-t border-border text-right">
                          <Link
                            to="/genomics/genes/$id"
                            params={{ id: g.symbol }}
                            className="label-mono text-[11px] text-blue hover:underline inline-flex items-center gap-1"
                          >
                            <span>Gene Profile</span>
                            <ArrowUpRight size={11} />
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

            {/* 3. Variants Section */}
            {(search.category === "all" || search.category === "variants") &&
              searchResult.variants.length > 0 && (
                <section>
                  <SectionLabel n="03">Curated Variants ({searchResult.variants.length})</SectionLabel>
                  <div className="border border-border bg-paper rounded-[3px] overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left font-mono text-xs">
                        <thead>
                          <tr className="bg-mist/70 border-b border-border text-muted-foreground label-mono text-[10px]">
                            <th className="py-3 px-4">Variant Accession</th>
                            <th className="py-3 px-4">Significance</th>
                            <th className="py-3 px-4">Review Status</th>
                            <th className="py-3 px-4">Locus</th>
                            <th className="py-3 px-4 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {searchResult.variants.map((v: any) => (
                            <tr key={v.id} className="hover:bg-mist/30 transition-colors">
                              <td className="py-3.5 px-4">
                                <Link
                                  to="/genomics/variants/$id"
                                  params={{ id: v.clinvar_vcv }}
                                  className="font-semibold text-foreground hover:text-blue transition-colors"
                                >
                                  {v.preferred_name || v.clinvar_vcv}
                                </Link>
                                <div className="text-[10px] text-muted-foreground label-mono mt-0.5">
                                  VCV: {v.clinvar_vcv} {v.dbsnp_id && `· dbSNP: ${v.dbsnp_id}`}
                                </div>
                              </td>
                              <td className="py-3.5 px-4">
                                <PathogenicityBadge significance={v.clinical_significance} />
                              </td>
                              <td className="py-3.5 px-4">
                                <ClinVarStarsBadge
                                  stars={v.gold_stars}
                                  reviewStatus={v.review_status_clinvar}
                                />
                              </td>
                              <td className="py-3.5 px-4 text-muted-foreground text-xs font-mono">
                                {v.chromosome && `Chr ${v.chromosome}:${v.position_vcf}`}
                              </td>
                              <td className="py-3.5 px-4 text-right">
                                <Link
                                  to="/genomics/variants/$id"
                                  params={{ id: v.clinvar_vcv }}
                                  className="label-mono text-[11px] text-blue hover:underline inline-flex items-center gap-1"
                                >
                                  <span>Evidence</span>
                                  <ArrowUpRight size={11} />
                                </Link>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </section>
              )}

            {/* 4. Phenotypes Section */}
            {(search.category === "all" || search.category === "phenotypes") &&
              phenotypes.length > 0 && (
                <section>
                  <SectionLabel n="04">Phenotypes ({phenotypes.length})</SectionLabel>
                  <div className="grid gap-px border border-border bg-rule sm:grid-cols-2">
                    {phenotypes.map((p: any) => (
                      <div key={p.id} className="bg-paper p-6 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <span className="font-mono text-xs text-blue font-semibold">
                              {p.hpo_id}
                            </span>
                            <span className="label-mono text-[10px] text-muted-foreground">
                              HPO Term
                            </span>
                          </div>
                          <h3 className="font-display text-xl text-foreground">{p.term}</h3>
                          {p.definition && (
                            <p className="mt-2 text-xs text-muted-foreground font-sans line-clamp-2">
                              {p.definition}
                            </p>
                          )}
                        </div>
                        {Array.isArray(p.diseases) && p.diseases.length > 0 && (
                          <div className="mt-4 pt-3 border-t border-border flex items-center gap-2 flex-wrap">
                            <span className="label-mono text-[10px] text-muted-foreground">
                              Associated:
                            </span>
                            {p.diseases.map((d: any) => (
                              <Link
                                key={d.slug}
                                to="/genomics/diseases/$id"
                                params={{ id: d.slug }}
                                className="label-mono text-[11px] text-blue hover:underline"
                              >
                                {d.name}
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}

            {/* 5. Publications Section */}
            {(search.category === "all" || search.category === "publications") &&
              publications.length > 0 && (
                <section>
                  <SectionLabel n="05">Publications ({publications.length})</SectionLabel>
                  <div className="border border-border bg-paper rounded-[3px] divide-y divide-border">
                    {publications.map((pub: any) => (
                      <div key={pub.id} className="p-6 hover:bg-mist/20 transition-colors">
                        <div className="flex items-center justify-between gap-3 mb-2">
                          <span className="font-mono text-xs text-blue font-semibold">
                            {pub.pmid ? `PMID:${pub.pmid}` : pub.doi || "Reference"}
                          </span>
                          <span className="label-mono text-[10px] text-muted-foreground">
                            {pub.journal} {pub.pub_year ? `(${pub.pub_year})` : ""}
                          </span>
                        </div>
                        <h3 className="font-sans text-sm font-medium text-foreground">
                          {pub.title}
                        </h3>
                        {pub.authors && (
                          <p className="text-xs text-muted-foreground font-sans mt-1.5 line-clamp-1">
                            {Array.isArray(pub.authors) ? pub.authors.join(", ") : String(pub.authors)}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}
          </div>
        )}
        <ResearchUseDisclaimer />
      </main>
    </div>
  );
}
