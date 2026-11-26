import React from "react";
import { cn } from "@/lib/utils";

export function PathogenicityBadge({
  significance,
  className,
}: {
  significance: string;
  className?: string;
}) {
  const sig = (significance || "Unknown").toLowerCase();
  let tone = "bg-mist text-muted-foreground border-border";

  if (sig.includes("pathogenic") && !sig.includes("conflict") && !sig.includes("likely")) {
    tone = "bg-red-500/10 text-red-600 border-red-500/30";
  } else if (sig.includes("likely pathogenic")) {
    tone = "bg-amber-500/10 text-amber-700 border-amber-500/30";
  } else if (sig.includes("benign")) {
    tone = "bg-emerald-500/10 text-emerald-700 border-emerald-500/30";
  } else if (sig.includes("uncertain") || sig.includes("vus")) {
    tone = "bg-neutral-500/10 text-neutral-600 border-neutral-500/30";
  } else if (sig.includes("conflicting")) {
    tone = "bg-purple-500/10 text-purple-700 border-purple-500/30";
  }

  return (
    <span
      className={cn(
        "label-mono inline-flex items-center rounded-[2px] border px-2 py-0.5 text-[10px]",
        tone,
        className
      )}
      title={`ACMG Classification: ${significance}`}
    >
      {significance}
    </span>
  );
}

export function ClinVarStarsBadge({
  stars = 0,
  reviewStatus,
  className,
}: {
  stars?: number | undefined;
  reviewStatus?: string | undefined;
  className?: string;
}) {
  const starCount = typeof stars === "number" ? stars : 0;
  const starIcons = Array.from({ length: 4 }).map((_, i) => (
    <span
      key={i}
      className={i < starCount ? "text-blue" : "text-border"}
      aria-hidden="true"
    >
      ★
    </span>
  ));

  return (
    <span
      className={cn(
        "label-mono inline-flex items-center gap-1.5 rounded-[2px] border border-border bg-mist px-2 py-0.5 text-[10px] text-foreground",
        className
      )}
      title={reviewStatus || `${starCount} Gold Stars (ClinVar)`}
    >
      <span className="flex text-xs leading-none tracking-tighter">{starIcons}</span>
      <span>{starCount}/4</span>
    </span>
  );
}

export function InheritanceBadge({
  mode,
  className,
}: {
  mode?: string | null | undefined;
  className?: string;
}) {
  if (!mode) return null;
  return (
    <span
      className={cn(
        "label-mono inline-flex items-center rounded-[2px] border border-blue/25 bg-blue/5 px-2 py-0.5 text-[10px] text-blue",
        className
      )}
    >
      {mode}
    </span>
  );
}

export function EvidenceLevelBadge({
  level,
  className,
}: {
  level?: string | null | undefined;
  className?: string;
}) {
  if (!level) return null;
  const isDefinitive = level.toLowerCase().includes("definitive");
  return (
    <span
      className={cn(
        "label-mono inline-flex items-center rounded-[2px] border px-2 py-0.5 text-[10px]",
        isDefinitive
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-800"
          : "border-border bg-mist text-muted-foreground",
        className
      )}
    >
      ClinGen · {level}
    </span>
  );
}

export function CurationStatusBadge({
  status,
  className,
}: {
  status?: string | null | undefined;
  className?: string;
}) {
  const norm = (status || "source_imported").toLowerCase();
  let label = "Source-Imported · Pending Scientist Review";
  let tone = "border-amber-500/30 bg-amber-500/10 text-amber-800";

  if (norm === "approved") {
    label = "Scientist-Approved";
    tone = "border-emerald-500/30 bg-emerald-500/10 text-emerald-800";
  } else if (norm === "needs_revision" || norm === "modified") {
    label = "Needs Revision";
    tone = "border-blue/30 bg-blue/5 text-blue";
  } else if (norm === "flagged") {
    label = "Flagged for Review";
    tone = "border-rose-500/30 bg-rose-500/10 text-rose-700";
  } else if (norm === "rejected") {
    label = "Rejected";
    tone = "border-rose-500/40 bg-rose-500/15 text-rose-800";
  }

  return (
    <span
      className={cn(
        "label-mono inline-flex items-center rounded-[2px] border px-2 py-0.5 text-[10px]",
        tone,
        className
      )}
    >
      {label}
    </span>
  );
}

export function ProvenanceStrip({
  sourceVersion,
  retrievalDate,
  reviewStatus,
}: {
  sourceVersion?: string | null | undefined;
  retrievalDate?: string | Date | null | undefined;
  reviewStatus?: string | null | undefined;
}) {
  const formattedDate = retrievalDate
    ? new Date(retrievalDate).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "Not recorded";

  return (
    <div className="mt-4 pt-3 border-t border-border/70 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[11px] font-mono text-muted-foreground">
      <span>
        Source Version: <strong className="text-foreground">{sourceVersion || "Not reported"}</strong>
      </span>
      <span>
        Last Synchronized: <strong className="text-foreground">{formattedDate}</strong>
      </span>
      <span>
        Curation:{" "}
        <strong className="text-foreground">
          {reviewStatus === "approved"
            ? "Scientist-Approved"
            : "Source-Imported (Pending Scientist Review)"}
        </strong>
      </span>
    </div>
  );
}

export function ResearchUseDisclaimer({ className }: { className?: string }) {
  return (
    <div className={cn("mt-10 p-5 border border-border bg-paper rounded-[3px]", className)}>
      <div className="flex items-center gap-2 mb-1.5">
        <span className="size-1.5 bg-amber-500" />
        <span className="label-mono text-foreground font-semibold text-[11px]">
          Research Use Only (RUO) — Not for Clinical Diagnostic Use
        </span>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed font-sans">
        The AKAHELIX Genomics Knowledge Base is a scientific research and reference curation repository synchronized from NCBI Gene, ClinVar, MedGen, PubMed, HGNC, and HPO. Automated source-imported records are explicitly separated from scientist-approved curation. Incomplete or unverified evidence is labeled accordingly and must not be used for patient diagnosis, prognosis, or clinical decision-making.
      </p>
    </div>
  );
}
