import React, { useState, useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, DownloadSimple } from "@phosphor-icons/react";
import { PathogenicityBadge } from "./GenomicsBadges";

export interface GenomicsAnalyticsData {
  relationships: {
    diseases: Array<{
      id: string;
      slug: string;
      name: string;
      omim_id?: string | null;
      inheritance_mode?: string | null;
      review_status?: string;
    }>;
    genes: Array<{
      id: string;
      symbol: string;
      name: string;
      chromosome?: string | null;
      hgnc_id?: string | null;
      review_status?: string;
    }>;
    variants: Array<{
      id: string;
      clinvar_vcv: string;
      preferred_name: string;
      chromosome?: string | null;
      clinical_significance?: string | null;
      gold_stars?: number | null;
      review_status?: string;
    }>;
    diseaseGeneLinks: Array<{
      disease_id: string;
      gene_id: string;
      relationship_type?: string | null;
      evidence_level?: string | null;
    }>;
    variantGeneLinks: Array<{
      variant_id: string;
      gene_id: string;
      consequence?: string | null;
    }>;
    variantDiseaseLinks: Array<{
      variant_id: string;
      disease_id: string;
      clinical_significance?: string | null;
    }>;
  };
  chromosomeDistribution: Array<{
    chromosome: string;
    genesCount: number;
    variantsCount: number;
  }>;
  classificationStats: {
    bySignificance: Array<{ label: string; count: number }>;
    byReviewStatus: Array<{ status: string; count: number }>;
  };
  publicationTrends: Array<{ year: number; count: number }>;
  provenanceSources: Array<{
    id: string;
    name: string;
    base_url: string;
    license_type?: string | null;
    version_tag?: string | null;
    retrieval_date?: string | null;
    record_count?: number | null;
  }>;
  recentClassificationHistory: Array<{
    id: string;
    variant_id: string;
    clinvar_vcv: string;
    preferred_name?: string | null;
    previous_classification?: string | null;
    new_classification?: string | null;
    source_data_source?: string | null;
    change_summary?: string | null;
    changed_at: string;
  }>;
}

export function GenomicsVisualizations({ analytics }: { analytics: GenomicsAnalyticsData }) {
  const {
    relationships,
    chromosomeDistribution,
    classificationStats,
    publicationTrends,
    provenanceSources,
    recentClassificationHistory,
  } = analytics;

  const [selectedDiseaseId, setSelectedDiseaseId] = useState<string>(
    relationships.diseases[0]?.id || ""
  );

  // Compute connected genes & variants for the selected disease
  const selectedGraph = useMemo(() => {
    const disease = relationships.diseases.find((d) => d.id === selectedDiseaseId) || null;
    if (!disease) {
      return { disease: null, linkedGenes: [], linkedVariants: [] };
    }

    const dgLinks = relationships.diseaseGeneLinks.filter((l) => l.disease_id === disease.id);
    const linkedGeneIds = new Set(dgLinks.map((l) => l.gene_id));
    const linkedGenes = relationships.genes
      .filter((g) => linkedGeneIds.has(g.id))
      .map((g) => ({
        ...g,
        evidence_level: dgLinks.find((l) => l.gene_id === g.id)?.evidence_level || "Curated",
      }));

    const vdLinks = relationships.variantDiseaseLinks.filter((l) => l.disease_id === disease.id);
    const linkedVariantIds = new Set(vdLinks.map((l) => l.variant_id));
    // Also include variants linked to the disease's causative genes
    for (const vg of relationships.variantGeneLinks) {
      if (linkedGeneIds.has(vg.gene_id)) {
        linkedVariantIds.add(vg.variant_id);
      }
    }

    const linkedVariants = relationships.variants
      .filter((v) => linkedVariantIds.has(v.id))
      .map((v) => {
        const geneLink = relationships.variantGeneLinks.find((vg) => vg.variant_id === v.id);
        const gene = relationships.genes.find((g) => g.id === geneLink?.gene_id);
        return {
          ...v,
          geneSymbol: gene?.symbol || null,
        };
      });

    return { disease, linkedGenes, linkedVariants };
  }, [relationships, selectedDiseaseId]);

  const maxChromCount = Math.max(
    1,
    ...chromosomeDistribution.map((c) => Math.max(c.genesCount, c.variantsCount))
  );
  const totalVariantsForStats = Math.max(
    1,
    classificationStats.bySignificance.reduce((sum, s) => sum + Number(s.count), 0)
  );
  const maxPubCount = Math.max(1, ...publicationTrends.map((p) => Number(p.count)));

  return (
    <div className="space-y-12">
      {/* 1. Disease -> Gene -> Variant Relationship Explorer */}
      <div className="border border-border bg-paper rounded-[3px]">
        <div className="px-6 py-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-mist/20">
          <div>
            <span className="label-mono text-muted-foreground block">
              R—01 / Relational Causality Map
            </span>
            <h3 className="font-display text-lg tracking-tight text-foreground mt-0.5">
              Disease · Gene · Variant Evidence Graph
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/api/genomics?action=export&format=csv"
              className="label-mono text-[11px] px-3 py-1.5 border border-border bg-background hover:border-foreground rounded-[2px] inline-flex items-center gap-1.5 transition-colors"
            >
              <DownloadSimple size={12} />
              <span>Export Public CSV</span>
            </a>
            <a
              href="/api/genomics?action=export&format=json"
              className="label-mono text-[11px] px-3 py-1.5 border border-border bg-background hover:border-foreground rounded-[2px] inline-flex items-center gap-1.5 transition-colors"
            >
              <DownloadSimple size={12} />
              <span>JSON</span>
            </a>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-border">
          {/* Column 1: Published Diseases */}
          <div className="lg:col-span-4 p-5">
            <span className="label-mono text-[10px] text-muted-foreground block mb-3">
              01 / Select Condition ({relationships.diseases.length})
            </span>
            <div className="space-y-1.5 max-h-[340px] overflow-y-auto pr-1">
              {relationships.diseases.map((d) => {
                const active = d.id === selectedDiseaseId;
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setSelectedDiseaseId(d.id)}
                    className={`w-full text-left px-3 py-2.5 border rounded-[2px] transition-colors ${
                      active
                        ? "border-blue bg-blue/5 text-foreground"
                        : "border-border bg-background text-muted-foreground hover:text-foreground hover:border-foreground/40"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-sans text-sm font-medium text-foreground truncate">
                        {d.name}
                      </span>
                      {d.omim_id && (
                        <span className="label-mono text-[10px] text-muted-foreground shrink-0">
                          OMIM:{d.omim_id}
                        </span>
                      )}
                    </div>
                    {d.inheritance_mode && (
                      <span className="label-mono text-[10px] text-blue block mt-1">
                        {d.inheritance_mode}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Column 2: Linked Causative Genes */}
          <div className="lg:col-span-3 p-5 bg-mist/10">
            <span className="label-mono text-[10px] text-muted-foreground block mb-3">
              02 / Causative Loci ({selectedGraph.linkedGenes.length})
            </span>
            {selectedGraph.linkedGenes.length === 0 ? (
              <p className="text-xs text-muted-foreground font-sans py-4">
                No published gene links recorded for this condition.
              </p>
            ) : (
              <div className="space-y-2.5">
                {selectedGraph.linkedGenes.map((g) => (
                  <Link
                    key={g.id}
                    to="/genomics/genes/$id"
                    params={{ id: g.symbol }}
                    className="block p-3 border border-border bg-paper rounded-[2px] hover:border-blue transition-colors group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sm font-semibold text-foreground group-hover:text-blue">
                        {g.symbol}
                      </span>
                      <ArrowUpRight size={12} className="text-muted-foreground group-hover:text-blue" />
                    </div>
                    <div className="text-xs text-muted-foreground font-sans mt-1 truncate">
                      {g.name}
                    </div>
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/60 label-mono text-[10px]">
                      <span>Chr {g.chromosome || "—"}</span>
                      <span className="text-blue">{g.evidence_level}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
            {selectedGraph.disease && (
              <div className="mt-4 pt-3 border-t border-border">
                <Link
                  to="/genomics/diseases/$id"
                  params={{ id: selectedGraph.disease.slug }}
                  className="label-mono text-[11px] text-blue hover:underline inline-flex items-center gap-1"
                >
                  <span>Open Condition Dossier</span>
                  <ArrowUpRight size={12} />
                </Link>
              </div>
            )}
          </div>

          {/* Column 3: Linked Public Variants */}
          <div className="lg:col-span-5 p-5">
            <span className="label-mono text-[10px] text-muted-foreground block mb-3">
              03 / Eligible Public Variants ({selectedGraph.linkedVariants.length})
            </span>
            {selectedGraph.linkedVariants.length === 0 ? (
              <p className="text-xs text-muted-foreground font-sans py-4">
                No published variants linked to this condition.
              </p>
            ) : (
              <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                {selectedGraph.linkedVariants.map((v) => (
                  <Link
                    key={v.id}
                    to="/genomics/variants/$id"
                    params={{ id: v.clinvar_vcv }}
                    className="block p-3 border border-border bg-background rounded-[2px] hover:border-blue transition-colors group"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs text-blue font-semibold">
                        {v.clinvar_vcv}
                      </span>
                      <PathogenicityBadge significance={v.clinical_significance || "Uncertain"} />
                    </div>
                    <div className="font-sans text-xs text-foreground mt-1.5 line-clamp-1 group-hover:text-blue">
                      {v.preferred_name}
                    </div>
                    <div className="flex items-center justify-between mt-1.5 label-mono text-[10px] text-muted-foreground">
                      <span>
                        {v.geneSymbol ? `Gene: ${v.geneSymbol}` : `Chr ${v.chromosome || "—"}`}
                      </span>
                      <span>Review: {v.review_status || "pending_review"}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. Chromosome Distribution, Clinical Classification Stats & Publication Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-px border border-border bg-rule">
        {/* Chromosome Distribution SVG Chart */}
        <div className="bg-paper p-6">
          <span className="label-mono text-muted-foreground block">
            C—01 / Genomic Loci Distribution
          </span>
          <h3 className="font-display text-lg tracking-tight text-foreground mt-1 mb-4">
            Chromosome Distribution
          </h3>
          {chromosomeDistribution.length === 0 ? (
            <p className="text-xs text-muted-foreground">No chromosome records available.</p>
          ) : (
            <div className="space-y-2.5">
              {chromosomeDistribution.map((row) => (
                <div key={row.chromosome} className="space-y-1">
                  <div className="flex items-center justify-between label-mono text-[11px]">
                    <span className="text-foreground font-semibold">Chr {row.chromosome}</span>
                    <span className="text-muted-foreground">
                      {row.genesCount}G · {row.variantsCount}V
                    </span>
                  </div>
                  <svg
                    viewBox="0 0 240 12"
                    className="w-full h-3 overflow-visible"
                    role="img"
                    aria-label={`Chromosome ${row.chromosome}: ${row.genesCount} genes, ${row.variantsCount} variants`}
                  >
                    <rect x="0" y="0" width="240" height="5" fill="#f3f4f6" rx="1" />
                    <rect
                      x="0"
                      y="0"
                      width={Math.max(4, (row.variantsCount / maxChromCount) * 240)}
                      height="5"
                      fill="#1946f7"
                      rx="1"
                    />
                    <rect x="0" y="7" width="240" height="4" fill="#f3f4f6" rx="1" />
                    <rect
                      x="0"
                      y="7"
                      width={Math.max(4, (row.genesCount / maxChromCount) * 240)}
                      height="4"
                      fill="#0f172a"
                      rx="1"
                    />
                  </svg>
                </div>
              ))}
              <div className="pt-2 flex items-center gap-4 label-mono text-[10px] text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block w-2.5 h-2 bg-blue" /> Variants
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block w-2.5 h-2 bg-foreground" /> Genes
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Clinical Classification Statistics */}
        <div className="bg-paper p-6">
          <span className="label-mono text-muted-foreground block">
            C—02 / ACMG-Guided Assertions
          </span>
          <h3 className="font-display text-lg tracking-tight text-foreground mt-1 mb-4">
            Clinical Classification Stats
          </h3>
          <div className="space-y-3">
            {classificationStats.bySignificance.map((item) => {
              const pct = Math.round((Number(item.count) / totalVariantsForStats) * 100);
              return (
                <div key={item.label} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-sans">
                    <span className="text-foreground truncate pr-2">{item.label}</span>
                    <span className="font-mono text-muted-foreground shrink-0">
                      {item.count} ({pct}%)
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-mist rounded-[1px] overflow-hidden">
                    <div className="h-full bg-blue" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 pt-4 border-t border-border">
            <span className="label-mono text-[10px] text-muted-foreground block mb-2">
              Scientific Curation Status (Public)
            </span>
            <div className="grid grid-cols-2 gap-2">
              {classificationStats.byReviewStatus.map((r) => (
                <div key={r.status} className="p-2.5 border border-border bg-mist/20 rounded-[2px]">
                  <span className="label-mono text-[10px] text-muted-foreground block">
                    {r.status}
                  </span>
                  <span className="numeral text-xl text-foreground">{r.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Publication Trends SVG Chart */}
        <div className="bg-paper p-6">
          <span className="label-mono text-muted-foreground block">
            C—03 / Peer-Reviewed Evidence
          </span>
          <h3 className="font-display text-lg tracking-tight text-foreground mt-1 mb-4">
            Publication Trends
          </h3>
          {publicationTrends.length === 0 ? (
            <p className="text-xs text-muted-foreground">No dated publications recorded.</p>
          ) : (
            <div>
              <svg
                viewBox="0 0 280 140"
                className="w-full h-36 border-b border-border"
                role="img"
                aria-label="Publication counts by year"
              >
                {publicationTrends.map((pt, idx) => {
                  const barWidth = Math.min(32, Math.floor(240 / publicationTrends.length) - 6);
                  const step = 260 / publicationTrends.length;
                  const x = 14 + idx * step;
                  const h = Math.max(8, (Number(pt.count) / maxPubCount) * 100);
                  const y = 115 - h;
                  return (
                    <g key={pt.year}>
                      <rect x={x} y={y} width={barWidth} height={h} fill="#1946f7" rx="1" />
                      <text
                        x={x + barWidth / 2}
                        y={y - 4}
                        textAnchor="middle"
                        fontSize="9"
                        fill="#0f172a"
                        fontFamily="monospace"
                      >
                        {pt.count}
                      </text>
                      <text
                        x={x + barWidth / 2}
                        y="132"
                        textAnchor="middle"
                        fontSize="9"
                        fill="#64748b"
                        fontFamily="monospace"
                      >
                        {pt.year}
                      </text>
                    </g>
                  );
                })}
              </svg>
              <p className="text-[11px] text-muted-foreground font-sans mt-3">
                Counts reflect PubMed-indexed citations linked in PostgreSQL `genomics.publications`.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 3. Scientific Provenance, Retrieval Dates & Classification History */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-px border border-border bg-rule">
        <div className="lg:col-span-6 bg-paper p-6">
          <span className="label-mono text-muted-foreground block">
            P—01 / Authoritative Sources & Retrieval Dates
          </span>
          <h3 className="font-display text-lg tracking-tight text-foreground mt-1 mb-4">
            Data Source Provenance
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border label-mono text-[10px] text-muted-foreground">
                  <th className="py-2 pr-3">Source</th>
                  <th className="py-2 pr-3">Version Tag</th>
                  <th className="py-2 pr-3">Retrieved</th>
                  <th className="py-2">License</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 text-xs font-sans">
                {provenanceSources.map((src) => (
                  <tr key={src.id}>
                    <td className="py-2.5 pr-3 font-medium text-foreground">{src.name}</td>
                    <td className="py-2.5 pr-3 font-mono text-[11px] text-blue">
                      {src.version_tag || "Active API"}
                    </td>
                    <td className="py-2.5 pr-3 font-mono text-[11px] text-muted-foreground">
                      {src.retrieval_date
                        ? new Date(src.retrieval_date).toLocaleDateString()
                        : "Live Sync"}
                    </td>
                    <td className="py-2.5 text-muted-foreground">{src.license_type || "Public"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="lg:col-span-6 bg-paper p-6">
          <span className="label-mono text-muted-foreground block">
            P—02 / ClinVar Classification Shifts
          </span>
          <h3 className="font-display text-lg tracking-tight text-foreground mt-1 mb-4">
            Classification History Ledger
          </h3>
          {recentClassificationHistory.length === 0 ? (
            <p className="text-xs text-muted-foreground font-sans">
              No classification shifts recorded for published variants yet.
            </p>
          ) : (
            <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-1">
              {recentClassificationHistory.map((ch) => (
                <div
                  key={ch.id}
                  className="p-3 border border-border bg-mist/15 rounded-[2px] text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <Link
                      to="/genomics/variants/$id"
                      params={{ id: ch.clinvar_vcv }}
                      className="font-mono font-semibold text-blue hover:underline"
                    >
                      {ch.clinvar_vcv}
                    </Link>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {new Date(ch.changed_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="mt-1 font-sans text-foreground">
                    <span className="text-muted-foreground">
                      {ch.previous_classification || "Initial"}
                    </span>{" "}
                    → <span className="font-medium">{ch.new_classification || "Updated"}</span>
                  </div>
                  {ch.change_summary && (
                    <div className="mt-1 text-[11px] text-muted-foreground line-clamp-1">
                      {ch.change_summary}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
