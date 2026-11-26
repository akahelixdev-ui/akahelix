import React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowSquareOut,
  ArrowLeft,
  ArrowUpRight,
} from "@phosphor-icons/react";

import { GenomicsHeader } from "@/genomics/components/GenomicsHeader";
import { GenomicsBreadcrumbs } from "@/genomics/components/GenomicsBreadcrumbs";
import {
  PathogenicityBadge,
  ClinVarStarsBadge,
  InheritanceBadge,
  EvidenceLevelBadge,
  CurationStatusBadge,
  ProvenanceStrip,
  ResearchUseDisclaimer,
} from "@/genomics/components/GenomicsBadges";
import { getGeneDetailFn } from "@/genomics/functions";
import { Chip, SectionLabel } from "@/components/site/Section";

export const Route = createFileRoute("/genomics/genes/$id")({
  loader: async ({ params }) => {
    return await getGeneDetailFn({ data: params.id });
  },
  head: ({ loaderData }) => {
    const data = (loaderData || {}) as any;
    return {
      meta: [
        {
          title: data?.symbol
            ? `${data.symbol} Gene Profile · Chromosome ${data.chromosome} · AKAHELIX Genomics`
            : "Gene Profile · AKAHELIX Genomics",
        },
        {
          name: "description",
          content: data?.summary
            ? data.summary.slice(0, 160)
            : "Human gene profile in the AKAHELIX Genomics Database.",
        },
      ],
    };
  },
  component: GeneDetailPage,
});

function GeneDetailPage() {
  const data = Route.useLoaderData();
  const gene = (data || {}) as any;

  const diseases: any[] = gene.diseases || [];
  const variants: any[] = gene.variants || [];
  const publications: any[] = gene.publications || [];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <GenomicsHeader />

      <main className="container-x py-8 md:py-10">
        <GenomicsBreadcrumbs
          items={[
            { label: "Genes", href: "/genomics/genes" },
            { label: gene.symbol },
          ]}
        />

        {/* Back navigation */}
        <div className="mb-6">
          <Link
            to="/genomics/genes"
            className="inline-flex items-center gap-1.5 label-mono text-muted-foreground hover:text-foreground transition-colors text-[11px]"
          >
            <ArrowLeft size={12} />
            <span>Back to Genes Directory</span>
          </Link>
        </div>

        {/* Dossier Header Section */}
        <div className="border border-border bg-paper rounded-[3px] p-8 md:p-12 mb-16">
          <div className="grid-12 gap-y-8">
            <div className="col-span-12 lg:col-span-8">
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                <Chip>Human Gene</Chip>
                <CurationStatusBadge status={gene.review_status} />
                <span className="label-mono text-[10px] bg-mist border border-border px-2 py-0.5 rounded-[2px] text-muted-foreground">
                  Chr {gene.chromosome || "Not reported"}:{gene.cytoband || gene.cytogenetic_location || "Not reported"}
                </span>
                {gene.refseq_accession && (
                  <span className="label-mono text-[10px] bg-mist border border-border px-2 py-0.5 rounded-[2px] text-muted-foreground">
                    RefSeq: {gene.refseq_accession}
                  </span>
                )}
              </div>

              <h1 className="display-lg tracking-tight">
                {gene.symbol}
              </h1>

              <div className="lede text-muted-foreground mt-4">
                {gene.name}
              </div>

              <ProvenanceStrip
                sourceVersion={gene.source_payload_version}
                retrievalDate={gene.source_retrieval_date}
                reviewStatus={gene.review_status}
              />
            </div>

            {/* Identifiers & Coordinates Box */}
            <div className="col-span-12 lg:col-span-4 border border-border bg-mist/40 p-6 rounded-[2px] self-start space-y-3">
              <span className="label-mono text-muted-foreground block border-b border-border pb-2 text-[10px]">
                Locus & Assembly (GRCh38)
              </span>
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="text-muted-foreground">Entrez Gene ID:</span>
                <a
                  href={`https://www.ncbi.nlm.nih.gov/gene/${gene.entrez_gene_id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue hover:underline inline-flex items-center gap-1 font-semibold"
                >
                  {gene.entrez_gene_id} <ArrowSquareOut size={11} />
                </a>
              </div>
              {gene.hgnc_id && (
                <div className="flex justify-between items-center text-xs font-mono">
                  <span className="text-muted-foreground">HGNC:</span>
                  <span className="text-foreground">{gene.hgnc_id}</span>
                </div>
              )}
              {gene.ensembl_id && (
                <div className="flex justify-between items-center text-xs font-mono">
                  <span className="text-muted-foreground">Ensembl:</span>
                  <span className="text-foreground">{gene.ensembl_id}</span>
                </div>
              )}
              {gene.start_pos && gene.end_pos && (
                <div className="pt-2 border-t border-border text-[11px] font-mono">
                  <div className="text-muted-foreground mb-0.5">Coordinates:</div>
                  <div className="text-foreground">
                    {Number(gene.start_pos).toLocaleString()} – {Number(gene.end_pos).toLocaleString()}{" "}
                    ({gene.strand || "+"})
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Gene Summary Quote */}
          {gene.summary && (
            <div className="mt-8 pt-8 border-t border-border">
              <span className="label-mono text-muted-foreground block mb-2 text-[10px]">
                NCBI Gene Summary & Biological Function
              </span>
              <p className="text-sm text-foreground/80 font-sans leading-relaxed max-w-4xl">
                {gene.summary}
              </p>
            </div>
          )}
        </div>

        {/* Section 1: Linked Diseases */}
        <section className="mb-20">
          <SectionLabel n="01">Associated Diseases & Clinical Conditions ({diseases.length})</SectionLabel>

          {diseases.length === 0 ? (
            <p className="label-mono text-muted-foreground py-8">No disease associations recorded in this dataset.</p>
          ) : (
            <div className="grid gap-px border border-border bg-rule sm:grid-cols-2">
              {diseases.map((d) => (
                <div
                  key={d.id || d.slug}
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
                      <EvidenceLevelBadge level={d.evidence_level} />
                    </div>

                    <div className="flex items-center gap-2 label-mono text-muted-foreground text-[11px] mb-3">
                      <InheritanceBadge mode={d.inheritance_mode} />
                      {d.omim_id && <span>OMIM: {d.omim_id}</span>}
                    </div>

                    {d.curator_notes && (
                      <p className="mt-4 text-xs text-foreground/80 font-sans bg-mist p-3 rounded-[2px] border border-border">
                        {d.curator_notes}
                      </p>
                    )}
                  </div>

                  <div className="mt-6 pt-4 border-t border-border text-right">
                    <Link
                      to="/genomics/diseases/$id"
                      params={{ id: d.slug }}
                      className="label-mono text-[11px] text-blue hover:underline inline-flex items-center gap-1"
                    >
                      <span>View Full Disease Profile</span>
                      <ArrowUpRight size={11} />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Section 2: Variants in this Gene */}
        <section className="mb-20">
          <SectionLabel n="02">Curated Clinical Variants in {gene.symbol} ({variants.length})</SectionLabel>

          {variants.length === 0 ? (
            <p className="label-mono text-muted-foreground py-8">No variants linked in this gene dataset.</p>
          ) : (
            <div className="border border-border bg-paper rounded-[3px] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-xs">
                  <thead>
                    <tr className="bg-mist/70 border-b border-border text-muted-foreground label-mono text-[10px]">
                      <th className="py-3 px-4">Variant (HGVS / Preferred)</th>
                      <th className="py-3 px-4">cDNA / Protein</th>
                      <th className="py-3 px-4">Significance</th>
                      <th className="py-3 px-4">ClinVar Status</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {variants.map((v) => (
                      <tr key={v.id || v.clinvar_vcv} className="hover:bg-mist/30 transition-colors">
                        <td className="py-3.5 px-4">
                          <Link
                            to="/genomics/variants/$id"
                            params={{ id: v.clinvar_vcv }}
                            className="font-semibold text-foreground hover:text-blue transition-colors"
                          >
                            {v.preferred_name || v.clinvar_vcv}
                          </Link>
                          <div className="text-[10px] text-muted-foreground label-mono flex items-center gap-2 mt-0.5">
                            <span>VCV: {v.clinvar_vcv}</span>
                            {v.dbsnp_id && <span>· dbSNP: {v.dbsnp_id}</span>}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="text-foreground">{v.hgvs_cdna || "—"}</div>
                          <div className="text-muted-foreground text-[11px]">{v.hgvs_protein || "—"}</div>
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
          )}
        </section>

        {/* Section 3: Publications */}
        {publications.length > 0 && (
          <section className="mb-20">
            <SectionLabel n="03">Primary Citations & Literature ({publications.length})</SectionLabel>
            <div className="border border-border bg-paper rounded-[3px] divide-y divide-border">
              {publications.map((pub) => (
                <div key={pub.id || pub.pmid} className="p-6 hover:bg-mist/30 transition-colors">
                  <a
                    href={`https://pubmed.ncbi.nlm.nih.gov/${pub.pmid}/`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-foreground hover:text-blue transition-colors text-sm sm:text-base leading-snug"
                  >
                    {pub.title || `PMID: ${pub.pmid}`}
                  </a>
                  <div className="label-mono text-muted-foreground text-[11px] mt-2">
                    {pub.journal || "Journal"} · {pub.pub_year || "PubMed"} · PMID: {pub.pmid}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
        <ResearchUseDisclaimer />
      </main>
    </div>
  );
}
