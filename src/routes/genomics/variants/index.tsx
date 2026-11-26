import React from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { MagnifyingGlass, ArrowUpRight } from "@phosphor-icons/react";

import { GenomicsHeader } from "@/genomics/components/GenomicsHeader";
import { GenomicsBreadcrumbs } from "@/genomics/components/GenomicsBreadcrumbs";
import { GenomicsDataTable, type ColumnDef } from "@/genomics/components/GenomicsDataTable";
import { PathogenicityBadge, ClinVarStarsBadge } from "@/genomics/components/GenomicsBadges";
import { getVariantsFn } from "@/genomics/functions";
import { Chip } from "@/components/site/Section";

interface VariantsSearchParams {
  page?: number | undefined;
  search?: string | undefined;
  significance?: string | undefined;
  chromosome?: string | undefined;
  gene?: string | undefined;
}

export const Route = createFileRoute("/genomics/variants/")({
  validateSearch: (search: Record<string, unknown>): VariantsSearchParams => {
    return {
      page: typeof search["page"] === "number" ? search["page"] : 1,
      search: typeof search["search"] === "string" ? search["search"] : undefined,
      significance: typeof search["significance"] === "string" ? search["significance"] : undefined,
      chromosome: typeof search["chromosome"] === "string" ? search["chromosome"] : undefined,
      gene: typeof search["gene"] === "string" ? search["gene"] : undefined,
    };
  },
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    return await getVariantsFn({
      data: {
        page: deps.page || 1,
        limit: 20,
        search: deps.search,
        significance: deps.significance,
        chromosome: deps.chromosome,
        geneSymbol: deps.gene,
      },
    });
  },
  head: () => ({
    meta: [
      { title: "Curated Genetic Variants · ClinVar VCV Registry · AKAHELIX Genomics" },
      {
        name: "description",
        content:
          "Authoritative clinical genetic variants catalog indexing ClinVar VCV accessions, dbSNP rsIDs, HGVS cDNA/protein nomenclature, and ACMG clinical significance.",
      },
    ],
  }),
  component: VariantsIndexPage,
});

function VariantsIndexPage() {
  const search = Route.useSearch();
  const data = Route.useLoaderData();
  const navigate = useNavigate();

  const handlePageChange = (newPage: number) => {
    navigate({
      to: "/genomics/variants",
      search: { ...search, page: newPage },
    });
  };

  const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const q = (formData.get("q") as string) || undefined;
    navigate({
      to: "/genomics/variants",
      search: { ...search, search: q, page: 1 },
    });
  };

  const handleSignificanceFilter = (sig?: string) => {
    navigate({
      to: "/genomics/variants",
      search: { ...search, significance: sig, page: 1 },
    });
  };

  const columns: ColumnDef<any>[] = [
    {
      key: "preferred_name",
      header: "Preferred Name / Accession",
      render: (v) => (
        <div>
          <Link
            to="/genomics/variants/$id"
            params={{ id: v.clinvar_vcv }}
            className="font-semibold text-foreground hover:text-blue transition-colors text-xs"
          >
            {v.preferred_name || v.clinvar_vcv}
          </Link>
          <div className="flex items-center gap-2 text-[10px] label-mono text-muted-foreground mt-0.5">
            <span>VCV: {v.clinvar_vcv}</span>
            {v.dbsnp_id && <span>· dbSNP: {v.dbsnp_id}</span>}
          </div>
        </div>
      ),
    },
    {
      key: "gene",
      header: "Gene",
      render: (v) => {
        const gene = v.gene_symbol || (v.genes && v.genes[0]?.symbol);
        if (!gene) return <span className="text-muted-foreground">—</span>;
        return (
          <Link
            to="/genomics/genes/$id"
            params={{ id: gene }}
            className="label-mono text-[11px] px-2 py-0.5 bg-mist border border-border text-foreground rounded-[2px] hover:border-blue transition-colors inline-block"
          >
            {gene}
          </Link>
        );
      },
    },
    {
      key: "hgvs",
      header: "HGVS cDNA / Protein",
      render: (v) => (
        <div className="text-xs font-mono text-foreground">
          <div>{v.hgvs_cdna || "—"}</div>
          <div className="text-muted-foreground text-[10px]">{v.hgvs_protein || "—"}</div>
        </div>
      ),
    },
    {
      key: "genomic_pos",
      header: "Genomic Locus (GRCh38)",
      render: (v) => (
        <div className="text-xs font-mono text-foreground">
          <div>Chr {v.chromosome}:{Number(v.position_vcf).toLocaleString()}</div>
          {v.ref_allele && v.alt_allele && (
            <div className="text-[10px] text-muted-foreground label-mono mt-0.5">
              {v.ref_allele} &gt; {v.alt_allele} ({v.variant_type || "snv"})
            </div>
          )}
        </div>
      ),
    },
    {
      key: "significance",
      header: "Clinical Significance",
      render: (v) => <PathogenicityBadge significance={v.clinical_significance} />,
    },
    {
      key: "clinvar_stars",
      header: "Review Status",
      render: (v) => (
        <ClinVarStarsBadge stars={v.gold_stars} reviewStatus={v.review_status_clinvar} />
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (v) => (
        <Link
          to="/genomics/variants/$id"
          params={{ id: v.clinvar_vcv }}
          className="label-mono text-[11px] text-blue hover:underline inline-flex items-center gap-1"
        >
          <span>Evidence</span>
          <ArrowUpRight size={11} />
        </Link>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <GenomicsHeader />

      <main className="container-x py-10 md:py-16">
        <GenomicsBreadcrumbs items={[{ label: "Variants" }]} />

        {/* Hero & Query Controls */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-8 border-b border-border pb-8">
          <div>
            <Chip className="mb-4">ClinVar & ACMG Registry</Chip>
            <h1 className="display-lg tracking-tight">Curated Genetic Variants</h1>
            <p className="lede text-muted-foreground mt-4 max-w-[65ch]">
              NCBI ClinVar VCV accessions, cDNA/protein HGVS definitions, and ACMG-classified clinical assertions.
            </p>
          </div>

          {/* Search & Significance Filter */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-64">
              <MagnifyingGlass size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                name="q"
                defaultValue={search.search || ""}
                placeholder="Search VCV, rsID, cDNA..."
                className="w-full pl-8 pr-3 py-2 text-xs font-mono border border-border rounded-[3px] bg-paper text-foreground placeholder:text-muted-foreground outline-none focus:border-blue transition-colors"
              />
            </form>

            <div className="flex items-center gap-1 border border-border bg-paper p-1 rounded-[3px]">
              <button
                type="button"
                onClick={() => handleSignificanceFilter(undefined)}
                className={`px-2.5 py-1 text-[11px] label-mono uppercase rounded-[2px] transition-colors ${
                  !search.significance
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => handleSignificanceFilter("Pathogenic")}
                className={`px-2.5 py-1 text-[11px] label-mono uppercase rounded-[2px] transition-colors ${
                  search.significance === "Pathogenic"
                    ? "bg-rose-600 text-white"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Pathogenic
              </button>
              <button
                type="button"
                onClick={() => handleSignificanceFilter("Likely pathogenic")}
                className={`px-2.5 py-1 text-[11px] label-mono uppercase rounded-[2px] transition-colors ${
                  search.significance === "Likely pathogenic"
                    ? "bg-amber-600 text-white"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Likely Path.
              </button>
            </div>
          </div>
        </div>

        {/* Data Table */}
        <GenomicsDataTable
          columns={columns}
          data={data.items}
          total={data.total}
          page={data.page}
          pageSize={data.limit}
          onPageChange={handlePageChange}
          keyExtractor={(item) => (item as any).id}
          emptyMessage="No clinical variants matching your filter parameters."
        />
      </main>
    </div>
  );
}
