import React from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowUpRight, MagnifyingGlass } from "@phosphor-icons/react";

import { GenomicsHeader } from "@/genomics/components/GenomicsHeader";
import { GenomicsBreadcrumbs } from "@/genomics/components/GenomicsBreadcrumbs";
import { GenomicsDataTable, type ColumnDef } from "@/genomics/components/GenomicsDataTable";
import { InheritanceBadge } from "@/genomics/components/GenomicsBadges";
import { getDiseasesFn } from "@/genomics/functions";
import { Chip, SectionLabel } from "@/components/site/Section";
import { cn } from "@/lib/utils";

interface DiseasesSearchParams {
  page?: number | undefined;
  search?: string | undefined;
  inheritance?: string | undefined;
}

export const Route = createFileRoute("/genomics/diseases/")({
  validateSearch: (search: Record<string, unknown>): DiseasesSearchParams => {
    return {
      page: typeof search["page"] === "number" ? search["page"] : 1,
      search: typeof search["search"] === "string" ? search["search"] : undefined,
      inheritance: typeof search["inheritance"] === "string" ? search["inheritance"] : undefined,
    };
  },
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    return await getDiseasesFn({
      data: {
        page: deps.page || 1,
        limit: 20,
        search: deps.search,
        inheritance: deps.inheritance,
      },
    });
  },
  head: () => ({
    meta: [
      { title: "Clinical Diseases & Phenotypes · AKAHELIX Genomics Database" },
      {
        name: "description",
        content:
          "Targeted genetic disease catalog indexing MedGen concept IDs, OMIM entries, modes of inheritance, causative loci, and clinical phenotypes for molecular diagnostic assay design.",
      },
    ],
  }),
  component: DiseasesIndexPage,
});

function DiseasesIndexPage() {
  const search = Route.useSearch();
  const data = Route.useLoaderData();
  const navigate = useNavigate();

  const handlePageChange = (newPage: number) => {
    navigate({
      to: "/genomics/diseases",
      search: { ...search, page: newPage },
    });
  };

  const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const q = (formData.get("q") as string) || undefined;
    navigate({
      to: "/genomics/diseases",
      search: { ...search, search: q, page: 1 },
    });
  };

  const handleInheritanceFilter = (mode?: string) => {
    navigate({
      to: "/genomics/diseases",
      search: { ...search, inheritance: mode, page: 1 },
    });
  };

  const columns: ColumnDef<any>[] = [
    {
      key: "name",
      header: "Condition / Phenotype",
      render: (d) => (
        <div>
          <Link
            to="/genomics/diseases/$id"
            params={{ id: d.slug }}
            className="font-display text-base font-normal text-foreground hover:text-blue transition-colors"
          >
            {d.name}
          </Link>
          <div className="text-[11px] text-muted-foreground font-sans mt-0.5 line-clamp-1">
            {d.definition || "Clinical genetics phenotype profile."}
          </div>
        </div>
      ),
    },
    {
      key: "identifiers",
      header: "Identifiers",
      render: (d) => (
        <div className="space-y-0.5 label-mono text-[11px] text-muted-foreground">
          {d.omim_id && <div>OMIM: <span className="text-foreground font-medium">{d.omim_id}</span></div>}
          {d.concept_id && <div>MedGen: <span>{d.concept_id}</span></div>}
          {d.orpha_code && <div>ORPHA: <span>{d.orpha_code}</span></div>}
        </div>
      ),
    },
    {
      key: "inheritance",
      header: "Inheritance",
      render: (d) => <InheritanceBadge mode={d.inheritance_mode} />,
    },
    {
      key: "genes",
      header: "Causative Loci",
      render: (d) => {
        const genes: { id: string; symbol: string; name: string }[] = d.genes || [];
        if (!genes || genes.length === 0) return <span className="text-muted-foreground">—</span>;
        return (
          <div className="flex flex-wrap gap-1">
            {genes.map((g) => (
              <Link
                key={g.id || g.symbol}
                to="/genomics/genes/$id"
                params={{ id: g.symbol }}
                className="label-mono text-[10px] bg-mist border border-border px-1.5 py-0.5 rounded-[2px] text-foreground hover:border-foreground transition-colors"
              >
                {g.symbol}
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
      render: (d) => (
        <span className="label-mono text-[11px] px-2 py-0.5 bg-mist text-foreground rounded-[2px] border border-border">
          {d.variant_count || 0}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (d) => (
        <Link
          to="/genomics/diseases/$id"
          params={{ id: d.slug }}
          className="label-mono text-[11px] text-blue hover:underline inline-flex items-center gap-1"
        >
          <span>Dossier</span>
          <ArrowUpRight size={11} />
        </Link>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <GenomicsHeader />

      <main className="container-x py-10 md:py-16">
        <GenomicsBreadcrumbs items={[{ label: "Diseases" }]} />

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10 pb-6 border-b border-border">
          <div>
            <Chip className="mb-4">Clinical Directory · Index 01</Chip>
            <h1 className="display-lg tracking-tight">
              Targeted Genetic Diseases
            </h1>
            <p className="lede text-muted-foreground mt-3 max-w-[60ch]">
              Curated medical genetics profiles with verified OMIM, MedGen, and HPO phenotype associations.
            </p>
          </div>

          {/* Quick Search & Filters */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-64">
              <MagnifyingGlass size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                name="q"
                defaultValue={search.search || ""}
                placeholder="Filter conditions..."
                className="w-full pl-8 pr-3 py-1.5 font-mono text-xs border border-border rounded-[2px] bg-paper outline-none focus:border-foreground"
              />
            </form>

            <div className="flex items-center gap-1 label-mono text-[11px]">
              <button
                type="button"
                onClick={() => handleInheritanceFilter(undefined)}
                className={cn(
                  "px-2.5 py-1 rounded-[2px] border transition-colors cursor-pointer",
                  !search.inheritance
                    ? "bg-foreground text-background border-foreground font-semibold"
                    : "bg-paper text-muted-foreground border-border hover:border-foreground/40"
                )}
              >
                ALL
              </button>
              <button
                type="button"
                onClick={() => handleInheritanceFilter("Autosomal recessive")}
                className={cn(
                  "px-2.5 py-1 rounded-[2px] border transition-colors cursor-pointer",
                  search.inheritance === "Autosomal recessive"
                    ? "bg-foreground text-background border-foreground font-semibold"
                    : "bg-paper text-muted-foreground border-border hover:border-foreground/40"
                )}
              >
                AR
              </button>
              <button
                type="button"
                onClick={() => handleInheritanceFilter("Autosomal dominant")}
                className={cn(
                  "px-2.5 py-1 rounded-[2px] border transition-colors cursor-pointer",
                  search.inheritance === "Autosomal dominant"
                    ? "bg-foreground text-background border-foreground font-semibold"
                    : "bg-paper text-muted-foreground border-border hover:border-foreground/40"
                )}
              >
                AD
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
          emptyMessage="No genetic diseases matching your filter parameters."
        />
      </main>
    </div>
  );
}
