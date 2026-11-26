import React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowSquareOut, ArrowLeft, ArrowUpRight } from "@phosphor-icons/react";

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
import { getDiseaseDetailFn } from "@/genomics/functions";
import { Chip, SectionLabel } from "@/components/site/Section";

export const Route = createFileRoute("/genomics/diseases/$id")({
  loader: async ({ params }) => {
    return await getDiseaseDetailFn({ data: params.id });
  },
  head: ({ loaderData }) => {
    const data = (loaderData || {}) as any;
    return {
      meta: [
        {
          title: data?.name
            ? `${data.name} · Clinical Genomics Profile · AKAHELIX`
            : "Disease Profile · AKAHELIX Genomics",
        },
        {
          name: "description",
          content: data?.definition
            ? data.definition.slice(0, 160)
            : "Clinical disease profile in the AKAHELIX Genomics Database.",
        },
      ],
    };
  },
  component: DiseaseDetailPage,
});

function DiseaseDetailPage() {
  const data = Route.useLoaderData();
  const disease = (data || {}) as any;

  const genes: any[] = disease.genes || [];
  const variants: any[] = disease.variants || [];
  const phenotypes: any[] = disease.phenotypes || [];
  const publications: any[] = disease.publications || [];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <GenomicsHeader />

      <main className="container-x py-8 md:py-10">
        <GenomicsBreadcrumbs
          items={[
            { label: "Diseases", href: "/genomics/diseases" },
            { label: disease.name || "Dossier" },
          ]}
        />

        {/* Back navigation */}
        <div className="mb-6">
          <Link
            to="/genomics/diseases"
            className="inline-flex items-center gap-1.5 label-mono text-muted-foreground hover:text-foreground transition-colors text-[11px]"
          >
            <ArrowLeft size={12} />
            <span>Back to Disease Directory</span>
          </Link>
        </div>

        {/* Dossier Header Section */}
        <div className="border border-border bg-paper rounded-[3px] p-8 md:p-12 mb-16">
          <div className="grid-12 gap-y-8">
            <div className="col-span-12 lg:col-span-8">
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                <Chip>Disease Profile</Chip>
                <CurationStatusBadge status={disease.review_status} />
                <InheritanceBadge mode={disease.inheritance_mode} />
                {disease.orpha_code && (
                  <span className="label-mono text-[10px] bg-mist border border-border px-2 py-0.5 rounded-[2px] text-muted-foreground">
                    ORPHA: {disease.orpha_code}
                  </span>
                )}
              </div>

              <h1 className="display-lg tracking-tight">
                {disease.name}
              </h1>

              {disease.curated_summary ? (
                <p className="lede text-muted-foreground mt-5 max-w-[65ch]">
                  {disease.curated_summary}
                </p>
              ) : disease.definition ? (
                <p className="lede text-muted-foreground mt-5 max-w-[65ch]">
                  {disease.definition}
                </p>
              ) : (
                <p className="text-xs font-mono text-muted-foreground mt-5">
                  Summary: Not reported by source (incomplete evidence).
                </p>
              )}

              <ProvenanceStrip
                sourceVersion={disease.source_payload_version}
                retrievalDate={disease.source_retrieval_date}
                reviewStatus={disease.review_status}
              />
            </div>

            {/* Specimen Identifier Block */}
            <div className="col-span-12 lg:col-span-4 border border-border bg-mist/40 p-6 rounded-[2px] self-start space-y-3">
              <span className="label-mono text-muted-foreground block border-b border-border pb-2 text-[10px]">
                Registry Accessions
              </span>

              {disease.concept_id && (
                <div className="flex justify-between items-center text-xs font-mono">
                  <span className="text-muted-foreground">MedGen CUI:</span>
                  <a
                    href={`https://www.ncbi.nlm.nih.gov/medgen/${disease.concept_id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue hover:underline inline-flex items-center gap-1 font-semibold"
                  >
                    {disease.concept_id} <ArrowSquareOut size={11} />
                  </a>
                </div>
              )}

              {disease.omim_id && (
                <div className="flex justify-between items-center text-xs font-mono">
                  <span className="text-muted-foreground">OMIM:</span>
                  <a
                    href={`https://omim.org/entry/${disease.omim_id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue hover:underline inline-flex items-center gap-1 font-semibold"
                  >
                    {disease.omim_id} <ArrowSquareOut size={11} />
                  </a>
                </div>
              )}

              {disease.mondo_id && (
                <div className="flex justify-between items-center text-xs font-mono">
                  <span className="text-muted-foreground">Mondo:</span>
                  <span className="text-foreground">{disease.mondo_id}</span>
                </div>
              )}

              {disease.icd10_cm && (
                <div className="flex justify-between items-center text-xs font-mono">
                  <span className="text-muted-foreground">ICD-10-CM:</span>
                  <span className="text-foreground font-semibold">{disease.icd10_cm}</span>
                </div>
              )}
            </div>
          </div>

          {/* Definition Quote */}
          {disease.definition && (
            <div className="mt-8 pt-8 border-t border-border">
              <span className="label-mono text-muted-foreground block mb-2 text-[10px]">
                Authoritative Biomedical Definition (MedGen / OMIM)
              </span>
              <p className="text-sm text-foreground/80 font-sans italic leading-relaxed max-w-4xl">
                "{disease.definition}"
              </p>
            </div>
          )}
        </div>

        {/* Section 1: Causative Genes */}
        <section className="mb-20">
          <SectionLabel n="01">Causative & Associated Genes</SectionLabel>

          {genes.length === 0 ? (
            <p className="label-mono text-muted-foreground py-8">No causative genes linked.</p>
          ) : (
            <div className="grid gap-px border border-border bg-rule sm:grid-cols-2">
              {genes.map((g) => (
                <div
                  key={g.id || g.symbol}
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
                      <EvidenceLevelBadge level={g.evidence_level} />
                    </div>

                    <div className="text-sm text-muted-foreground font-sans mb-3">{g.name}</div>

                    <div className="label-mono text-muted-foreground space-y-1 text-[11px]">
                      <div>Locus: Chr {g.chromosome}:{g.cytoband || "q"}</div>
                      <div>Entrez ID: {g.entrez_gene_id}</div>
                    </div>

                    {g.curator_notes && (
                      <p className="mt-4 text-xs text-foreground/80 font-sans bg-mist p-3 rounded-[2px] border border-border">
                        Curator note: {g.curator_notes}
                      </p>
                    )}
                  </div>

                  <div className="mt-6 pt-4 border-t border-border text-right">
                    <Link
                      to="/genomics/genes/$id"
                      params={{ id: g.symbol }}
                      className="label-mono text-[11px] text-blue hover:underline inline-flex items-center gap-1"
                    >
                      <span>Gene Coordinates</span>
                      <ArrowUpRight size={11} />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Section 2: Curated Clinical Variants */}
        <section className="mb-20">
          <SectionLabel n="02">ClinVar Variant Manifest</SectionLabel>

          {variants.length === 0 ? (
            <p className="label-mono text-muted-foreground py-8">No clinical variants cataloged for this condition.</p>
          ) : (
            <div className="border border-border bg-paper rounded-[3px] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-xs">
                  <thead>
                    <tr className="bg-mist/70 border-b border-border text-muted-foreground label-mono text-[10px]">
                      <th className="py-3 px-4">Variant Accession</th>
                      <th className="py-3 px-4">Significance</th>
                      <th className="py-3 px-4">ClinVar Status</th>
                      <th className="py-3 px-4">Consequence</th>
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
                        <td className="py-3.5 px-4 text-muted-foreground font-sans text-xs">
                          {v.molecular_consequence || "unspecified"}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <Link
                            to="/genomics/variants/$id"
                            params={{ id: v.clinvar_vcv }}
                            className="label-mono text-[11px] text-blue hover:underline"
                          >
                            Evidence
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

        {/* Section 3: Phenotypes */}
        <section className="mb-20">
          <SectionLabel n="03">Clinical Phenotypes (HPO)</SectionLabel>

          {phenotypes.length === 0 ? (
            <p className="label-mono text-muted-foreground py-8">No HPO terms cataloged.</p>
          ) : (
            <div className="grid gap-px border border-border bg-rule sm:grid-cols-2">
              {phenotypes.map((ph) => (
                <div
                  key={ph.id || ph.hpo_id}
                  className="bg-paper p-6 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between label-mono text-muted-foreground mb-1 text-[11px]">
                      <span className="text-foreground font-semibold">{ph.hpo_id}</span>
                      {ph.frequency && <span className="text-blue">{ph.frequency}</span>}
                    </div>
                    <div className="font-display text-lg text-foreground mt-2">{ph.term}</div>
                    {ph.definition && (
                      <p className="text-xs text-muted-foreground mt-2 font-sans line-clamp-2">
                        {ph.definition}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Section 4: Literature */}
        {publications.length > 0 && (
          <section className="mb-20">
            <SectionLabel n="04">Benchmark Literature Citations</SectionLabel>

            <ul className="border-t border-border divide-y divide-border">
              {publications.map((pub) => (
                <li key={pub.id || pub.pmid} className="py-6 flex flex-col sm:flex-row sm:items-baseline justify-between gap-4">
                  <div>
                    <a
                      href={`https://pubmed.ncbi.nlm.nih.gov/${pub.pmid}/`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-display text-base text-foreground hover:text-blue transition-colors leading-snug"
                    >
                      {pub.title || `PubMed Article PMID: ${pub.pmid}`}
                    </a>
                    <div className="label-mono text-muted-foreground mt-2 text-[11px]">
                      {pub.journal || "PubMed"} · {pub.pub_year || "Peer-Reviewed"}
                    </div>
                  </div>

                  <a
                    href={`https://pubmed.ncbi.nlm.nih.gov/${pub.pmid}/`}
                    target="_blank"
                    rel="noreferrer"
                    className="label-mono text-[11px] text-blue hover:underline inline-flex items-center gap-1 shrink-0"
                  >
                    <span>PMID: {pub.pmid}</span>
                    <ArrowSquareOut size={11} />
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}
        <ResearchUseDisclaimer />
      </main>
    </div>
  );
}
