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
  CurationStatusBadge,
  ProvenanceStrip,
  ResearchUseDisclaimer,
} from "@/genomics/components/GenomicsBadges";
import { getVariantDetailFn } from "@/genomics/functions";
import { Chip, SectionLabel } from "@/components/site/Section";

export const Route = createFileRoute("/genomics/variants/$id")({
  loader: async ({ params }) => {
    return await getVariantDetailFn({ data: params.id });
  },
  head: ({ loaderData }) => {
    const data = (loaderData || {}) as any;
    return {
      meta: [
        {
          title: data
            ? `${data.preferred_name || data.clinvar_vcv} · ClinVar Evidence · AKAHELIX Genomics`
            : "Variant Evidence · AKAHELIX Genomics",
        },
        {
          name: "description",
          content: data
            ? `Clinical evidence and ClinVar assertions for variant ${data.preferred_name || ""} (${data.clinvar_vcv || ""}).`
            : "Clinical variant details in the AKAHELIX Genomics Database.",
        },
      ],
    };
  },
  component: VariantDetailPage,
});

function VariantDetailPage() {
  const data = Route.useLoaderData();
  const variant = (data || {}) as any;

  const genes: any[] = variant.genes || [];
  const diseases: any[] = variant.diseases || [];
  const assertions: any[] = variant.assertions || [];
  const publications: any[] = variant.publications || [];

  // Parse ClinVar variation ID from VCV accession if possible (e.g. VCV000015408 -> 15408)
  const numericVariationId = variant.clinvar_vcv
    ? variant.clinvar_vcv.replace(/^VCV0*/i, "")
    : null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <GenomicsHeader />

      <main className="container-x py-8 md:py-10">
        <GenomicsBreadcrumbs
          items={[
            { label: "Variants", href: "/genomics/variants" },
            { label: variant.preferred_name || variant.clinvar_vcv },
          ]}
        />

        {/* Back navigation */}
        <div className="mb-6">
          <Link
            to="/genomics/variants"
            className="inline-flex items-center gap-1.5 label-mono text-muted-foreground hover:text-foreground transition-colors text-[11px]"
          >
            <ArrowLeft size={12} />
            <span>Back to Variants Registry</span>
          </Link>
        </div>

        {/* Dossier Header Section */}
        <div className="border border-border bg-paper rounded-[3px] p-8 md:p-12 mb-16">
          <div className="grid-12 gap-y-8">
            <div className="col-span-12 lg:col-span-8">
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                <Chip>ClinVar Record</Chip>
                <CurationStatusBadge status={variant.review_status} />
                <PathogenicityBadge significance={variant.clinical_significance} />
                <ClinVarStarsBadge
                  stars={variant.gold_stars}
                  reviewStatus={variant.review_status_clinvar}
                />
              </div>

              <h1 className="display-lg tracking-tight">
                {variant.preferred_name || variant.clinvar_vcv}
              </h1>

              <div className="flex items-center gap-3 text-xs font-mono text-muted-foreground mt-4 flex-wrap">
                <span>Accession: <strong className="text-foreground">{variant.clinvar_vcv}</strong></span>
                {variant.dbsnp_id && (
                  <span>
                    dbSNP:{" "}
                    <a
                      href={`https://www.ncbi.nlm.nih.gov/snp/${variant.dbsnp_id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue hover:underline font-semibold"
                    >
                      {variant.dbsnp_id}
                    </a>
                  </span>
                )}
                {variant.variant_type && (
                  <span className="label-mono text-[10px] bg-mist border border-border px-2 py-0.5 rounded-[2px] text-foreground">
                    {variant.variant_type}
                  </span>
                )}
                {variant.molecular_consequence && (
                  <span className="label-mono text-[10px] bg-mist border border-border px-2 py-0.5 rounded-[2px] text-foreground">
                    {variant.molecular_consequence}
                  </span>
                )}
              </div>

              <ProvenanceStrip
                sourceVersion={variant.source_payload_version}
                retrievalDate={variant.source_retrieval_date}
                reviewStatus={variant.review_status}
              />
            </div>

            {/* Genomic Coordinates Box */}
            <div className="col-span-12 lg:col-span-4 border border-border bg-mist/40 p-6 rounded-[2px] self-start space-y-3">
              <span className="label-mono text-muted-foreground block border-b border-border pb-2 text-[10px]">
                Genomic Coordinates ({variant.assembly || "GRCh38"})
              </span>
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="text-muted-foreground">Chromosome:</span>
                <span className="text-foreground font-semibold">{variant.chromosome || "Not reported"}</span>
              </div>
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="text-muted-foreground">Position (VCF):</span>
                <span className="text-foreground">
                  {variant.position_vcf ? Number(variant.position_vcf).toLocaleString() : "Not reported"}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="text-muted-foreground">Alleles (Ref &gt; Alt):</span>
                <span className="text-foreground font-mono">
                  {variant.ref_allele && variant.alt_allele
                    ? `${variant.ref_allele} > ${variant.alt_allele}`
                    : "Not reported by source"}
                </span>
              </div>
              <div className="pt-2 border-t border-border">
                <a
                  href={`https://www.ncbi.nlm.nih.gov/clinvar/variation/${numericVariationId || variant.clinvar_vcv}/`}
                  target="_blank"
                  rel="noreferrer"
                  className="label-mono text-[11px] text-blue hover:underline inline-flex items-center gap-1 font-semibold"
                >
                  <span>NCBI ClinVar Entry</span>
                  <ArrowSquareOut size={11} />
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Section 1: Associated Context (Gene & Disease) */}
        <section className="mb-20">
          <SectionLabel n="01">Biological & Clinical Context</SectionLabel>

          <div className="grid gap-px border border-border bg-rule sm:grid-cols-2">
            {/* Associated Gene */}
            <div className="bg-paper p-8 flex flex-col justify-between hover:bg-mist/30 transition-colors">
              <div>
                <span className="label-mono text-[10px] text-muted-foreground block mb-2 uppercase">
                  Gene Locus
                </span>
                {genes.length === 0 ? (
                  <p className="label-mono text-muted-foreground text-xs">No gene mapped directly.</p>
                ) : (
                  <div>
                    {genes.map((g) => (
                      <div key={g.id || g.symbol} className="mb-4">
                        <Link
                          to="/genomics/genes/$id"
                          params={{ id: g.symbol }}
                          className="font-display text-2xl font-normal text-foreground hover:text-blue transition-colors"
                        >
                          {g.symbol}
                        </Link>
                        <div className="text-sm text-muted-foreground font-sans mt-1">{g.name}</div>
                        <div className="label-mono text-muted-foreground text-[11px] mt-2">
                          Chr {g.chromosome}:{g.cytoband || "q"}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {genes.length > 0 && (
                <div className="mt-6 pt-4 border-t border-border text-right">
                  <Link
                    to="/genomics/genes/$id"
                    params={{ id: genes[0].symbol }}
                    className="label-mono text-[11px] text-blue hover:underline inline-flex items-center gap-1"
                  >
                    <span>View Gene Profile</span>
                    <ArrowUpRight size={11} />
                  </Link>
                </div>
              )}
            </div>

            {/* Associated Disease */}
            <div className="bg-paper p-8 flex flex-col justify-between hover:bg-mist/30 transition-colors">
              <div>
                <span className="label-mono text-[10px] text-muted-foreground block mb-2 uppercase">
                  Clinical Manifestation
                </span>
                {diseases.length === 0 ? (
                  <p className="label-mono text-muted-foreground text-xs">No disease mapped directly.</p>
                ) : (
                  <div>
                    {diseases.map((d) => (
                      <div key={d.id || d.slug} className="mb-4">
                        <Link
                          to="/genomics/diseases/$id"
                          params={{ id: d.slug }}
                          className="font-display text-2xl font-normal text-foreground hover:text-blue transition-colors"
                        >
                          {d.name}
                        </Link>
                        <div className="mt-2">
                          <InheritanceBadge mode={d.inheritance_mode} />
                        </div>
                        {d.omim_id && (
                          <div className="label-mono text-muted-foreground text-[11px] mt-2">
                            OMIM: {d.omim_id}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {diseases.length > 0 && (
                <div className="mt-6 pt-4 border-t border-border text-right">
                  <Link
                    to="/genomics/diseases/$id"
                    params={{ id: diseases[0].slug }}
                    className="label-mono text-[11px] text-blue hover:underline inline-flex items-center gap-1"
                  >
                    <span>View Condition Profile</span>
                    <ArrowUpRight size={11} />
                  </Link>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Section 2: Submitter Clinical Assertions (SCVs / RCVs) */}
        <section className="mb-20">
          <SectionLabel n="02">Submitter Evidence & Clinical Assertions ({assertions.length})</SectionLabel>

          {assertions.length === 0 ? (
            <p className="label-mono text-muted-foreground py-8">
              No individual submitter assertions ingested for this variant.
            </p>
          ) : (
            <div className="border border-border bg-paper rounded-[3px] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-xs">
                  <thead>
                    <tr className="bg-mist/70 border-b border-border text-muted-foreground label-mono text-[10px]">
                      <th className="py-3 px-4">SCV Accession</th>
                      <th className="py-3 px-4">RCV Accession</th>
                      <th className="py-3 px-4">Submitter / Expert Panel</th>
                      <th className="py-3 px-4">Clinical Significance</th>
                      <th className="py-3 px-4">Review Criteria</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {assertions.map((a, i) => (
                      <tr key={a.id || i} className="hover:bg-mist/30 transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-foreground">
                          {a.scv_accession || a.assertion_scv || "Not reported"}
                        </td>
                        <td className="py-3.5 px-4 text-muted-foreground">
                          {a.rcv_accession || a.assertion_rcv || "Not reported"}
                        </td>
                        <td className="py-3.5 px-4 text-foreground font-sans">
                          {a.submitter_name || "Not reported by source"}
                        </td>
                        <td className="py-3.5 px-4">
                          <PathogenicityBadge significance={a.clinical_significance || a.significance || "Not reported"} />
                        </td>
                        <td className="py-3.5 px-4 text-muted-foreground text-[11px]">
                          {a.assertion_method || a.review_status || a.review_criteria || "Not reported by source"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        {/* Section 3: Cited Literature */}
        {publications.length > 0 && (
          <section className="mb-20">
            <SectionLabel n="03">Cited Literature & Evidence ({publications.length})</SectionLabel>
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
                    {pub.journal || "PubMed"} · {pub.pub_year || "Peer-Reviewed"} · PMID: {pub.pmid}
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
