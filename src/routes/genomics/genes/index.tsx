import React from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowUpRight, MagnifyingGlass } from "@phosphor-icons/react";

import { GenomicsHeader } from "@/genomics/components/GenomicsHeader";
import { GenomicsBreadcrumbs } from "@/genomics/components/GenomicsBreadcrumbs";
import { GenomicsDataTable, type ColumnDef } from "@/genomics/components/GenomicsDataTable";
import { getGenesFn } from "@/genomics/functions";
import { Chip } from "@/components/site/Section";
import { cn } from "@/lib/utils";

interface GenesSearchParams {
  page?: number | undefined;
  search?: string | undefined;
  chromosome?: string | undefined;
}

export const Route = createFileRoute("/genomics/genes/")({
  validateSearch: (search: Record<string, unknown>): GenesSearchParams => {
    return {
      page: typeof search["page"] === "number" ? search["page"] : 1,
      search: typeof search["search"] === "string" ? search["search"] : undefined,
      chromosome: typeof search["chromosome"] === "string" ? search["chromosome"] : undefined,
    };
  },
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    return await getGenesFn({
      data: {
        page: deps.page || 1,
        limit: 20,
        search: deps.search,
        chromosome: deps.chromosome,
      },
    });
  },
  head: () => ({
    meta: [
      { title: "Human Genes Directory · Reference GRCh38 · AKAHELIX Genomics" },
      {
        name: "description",
        content:
          "Targeted human disease genes indexing HGNC symbols, NCBI Gene IDs, chromosomal cytobands, genomic loci, and associated genetic diseases.",
      },
    ],
  }),
  component: GenesIndexPage,
});

function GenesIndexPage() {
  const search = Route.useSearch();
  const data = Route.useLoaderData();
  const navigate = useNavigate();

  const handlePageChange = (newPage: number) => {
    navigate({
      to: "/genomics/genes",
      search: { ...search, page: newPage },
    });
  };

  const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const q = (formData.get("q") as string) || undefined;
    navigate({
      to: "/genomics/genes",
      search: { ...search, search: q, page: 1 },
    });
  };

  const handleChromosomeFilter = (chr?: string) => {
    navigate({
      to: "/genomics/genes",
      search: { ...search, chromosome: chr, page: 1 },
    });
  };

  const columns: ColumnDef<any>[] = [
    {
      key: "symbol",
      header: "Symbol",
      render: (g) => (
        <div>
          <Link
            to="/genomics/genes/$id"
            params={{ id: g.symbol }}
            className="font-display text-base font-normal text-foreground hover:text-blue transition-colors"
          >
            {g.symbol}
          </Link>
          <div className="label-mono text-[10px] text-muted-foreground mt-0.5">
            Entrez: {g.entrez_gene_id}
          </div>
        </div>
      ),
    },
    {
      key: "name",
      header: "Official Gene Name",
      render: (g) => (
        <div>
          <div className="text-xs font-sans text-foreground">{g.name}</div>
          {g.hgnc_id && (
            <div className="label-mono text-[10px] text-muted-foreground mt-0.5">
              HGNC: {g.hgnc_id}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "location",
      header: "Genomic Locus (GRCh38)",
      render: (g) => (
        <div className="label-mono text-muted-foreground text-[11px]">
          <div>Chr {g.chromosome}:{g.cytoband || "q"}</div>
          {g.start_pos && g.end_pos && (
            <div className="text-[10px] text-muted-foreground/70 mt-0.5">
              {Number(g.start_pos).toLocaleString()} - {Number(g.end_pos).toLocaleString()}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "diseases",
      header: "Associated Phenotypes",
      render: (g) => {
        const diseases: { id: string; name: string; slug: string }[] = g.diseases || [];
        if (!diseases || diseases.length === 0) return <span className="text-muted-foreground">—</span>;
        return (
          <div className="space-y-1">
            {diseases.map((d) => (
              <Link
                key={d.id || d.slug}
                to="/genomics/diseases/$id"
                params={{ id: d.slug }}
                className="block text-xs font-sans text-foreground/85 hover:text-blue transition-colors truncate max-w-[200px]"
              >
                • {d.name}
              </Link>
            ))}
          </div>
        );
      },
    },
    {
      key: "variants",
      header: "Variants",
      align: "center",
      render: (g) => (
        <span className="label-mono text-[11px] px-2 py-0.5 bg-mist text-foreground rounded-[2px] border border-border">
          {g.variant_count || 0}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (g) => (
        <Link
          to="/genomics/genes/$id"
          params={{ id: g.symbol }}
          className="label-mono text-[11px] text-blue hover:underline inline-flex items-center gap-1"
        >
          <span>Locus</span>
          <ArrowUpRight size={11} />
        </Link>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <GenomicsHeader />

      <main className="container-x py-10 md:py-16">
        <GenomicsBreadcrumbs items={[{ label: "Genes" }]} />

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10 pb-6 border-b border-border">
          <div>
            <Chip className="mb-4">Targeted Loci · Index 02</Chip>
            <h1 className="display-lg tracking-tight">
              Human Genes Directory
            </h1>
            <p className="lede text-muted-foreground mt-3 max-w-[60ch]">
              NCBI Gene & HGNC-indexed loci associated with clinical genetics panels and LDT validation targets.
            </p>
          </div>

          {/* Search & Chromosome Filter */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-64">
              <MagnifyingGlass size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                name="q"
                defaultValue={search.search || ""}
                placeholder="Search symbol (e.g. HBB)..."
                className="w-full pl-8 pr-3 py-1.5 font-mono text-xs border border-border rounded-[2px] bg-paper outline-none focus:border-foreground"
              />
            </form>

            <div className="flex items-center gap-1 label-mono text-[11px]">
              <button
                type="button"
                onClick={() => handleChromosomeFilter(undefined)}
                className={cn(
                  "px-2.5 py-1 rounded-[2px] border transition-colors cursor-pointer",
                  !search.chromosome
                    ? "bg-foreground text-background border-foreground font-semibold"
                    : "bg-paper text-muted-foreground border-border hover:border-foreground/40"
                )}
              >
                ALL
              </button>
              <button
                type="button"
                onClick={() => handleChromosomeFilter("11")}
                className={cn(
                  "px-2.5 py-1 rounded-[2px] border transition-colors cursor-pointer",
                  search.chromosome === "11"
                    ? "bg-foreground text-background border-foreground font-semibold"
                    : "bg-paper text-muted-foreground border-border hover:border-foreground/40"
                )}
              >
                CHR 11
              </button>
              <button
                type="button"
                onClick={() => handleChromosomeFilter("16")}
                className={cn(
                  "px-2.5 py-1 rounded-[2px] border transition-colors cursor-pointer",
                  search.chromosome === "16"
                    ? "bg-foreground text-background border-foreground font-semibold"
                    : "bg-paper text-muted-foreground border-border hover:border-foreground/40"
                )}
              >
                CHR 16
              </button>
              <button
                type="button"
                onClick={() => handleChromosomeFilter("7")}
                className={cn(
                  "px-2.5 py-1 rounded-[2px] border transition-colors cursor-pointer",
                  search.chromosome === "7"
                    ? "bg-foreground text-background border-foreground font-semibold"
                    : "bg-paper text-muted-foreground border-border hover:border-foreground/40"
                )}
              >
                CHR 7
              </button>
              <button
                type="button"
                onClick={() => handleChromosomeFilter("17")}
                className={cn(
                  "px-2.5 py-1 rounded-[2px] border transition-colors cursor-pointer",
                  search.chromosome === "17"
                    ? "bg-foreground text-background border-foreground font-semibold"
                    : "bg-paper text-muted-foreground border-border hover:border-foreground/40"
                )}
              >
                CHR 17
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
          emptyMessage="No human genes matching your filter parameters."
        />
      </main>
    </div>
  );
}
