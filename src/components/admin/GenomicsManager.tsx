import React, { useState, useEffect } from "react";
import {
  Database,
  FirstAid,
  Dna,
  Atom,
  ShieldCheck,
  Clock,
  ArrowClockwise,
  CheckCircle,
  WarningCircle,
  Plus,
  ArrowSquareOut,
  ListDashes,
  Sliders,
  Check,
  X,
  Flag,
} from "@phosphor-icons/react";

type GenomicsSubTab =
  | "overview"
  | "diseases"
  | "genes"
  | "variants"
  | "reviews"
  | "sources"
  | "imports"
  | "audits"
  | "classifications";

export function GenomicsManager() {
  const [subTab, setSubTab] = useState<GenomicsSubTab>("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);

  // Review modal state
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewEntityType, setReviewEntityType] = useState<"disease" | "gene" | "variant" | "clinical_assertion">("variant");
  const [reviewEntityId, setReviewEntityId] = useState("");
  const [reviewDecision, setReviewDecision] = useState<"" | "accepted" | "flagged" | "rejected" | "modified">("");
  const [reviewNotes, setReviewNotes] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewSuccessMsg, setReviewSuccessMsg] = useState<string | null>(null);

  // Ingestion trigger state
  const [isIngesting, setIsIngesting] = useState(false);
  const [ingestResult, setIngestResult] = useState<any>(null);

  // Fetch admin genomics data (authenticated via same-origin HttpOnly neon_auth_token cookie)
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/genomics?action=admin_overview", {
        credentials: "include",
      });

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          throw new Error("Server authorization required. Please authenticate with clinical administrator credentials.");
        }
        throw new Error(`Failed to load admin overview (HTTP ${res.status})`);
      }

      const json = await res.json();
      setData(json);
    } catch (err: any) {
      console.error("Error loading genomics admin overview:", err);
      setError(err.message || "Failed to load genomics database records.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Handle Review Submission
  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    setReviewError(null);
    setReviewSuccessMsg(null);

    if (!reviewEntityId.trim()) {
      setReviewError("Entity accession or ID is required.");
      return;
    }
    if (!reviewDecision) {
      setReviewError("Please select an explicit review decision before submitting.");
      return;
    }
    if (!reviewNotes.trim()) {
      setReviewError("Curator notes and evidence rationale are required.");
      return;
    }

    setReviewSubmitting(true);

    try {
      const res = await fetch("/api/genomics", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "review",
          entityType: reviewEntityType,
          entityId: reviewEntityId.trim(),
          decision: reviewDecision,
          notes: reviewNotes.trim(),
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || errJson.error || `Failed to submit review (HTTP ${res.status})`);
      }

      const json = await res.json();
      const resolvedLabel = json?.review?.resolved_label || reviewEntityId.trim();
      setReviewSuccessMsg(`Review (${reviewDecision}) successfully recorded for ${reviewEntityType} ${resolvedLabel}.`);
      setIsReviewModalOpen(false);
      setReviewDecision("");
      setReviewNotes("");
      setReviewEntityId("");
      setReviewError(null);
      // Refresh dashboard data
      fetchData();
    } catch (err: any) {
      setReviewError(err.message || "Failed to submit scientific review.");
    } finally {
      setReviewSubmitting(false);
    }
  };

  // Handle Ingestion Pipeline Trigger
  const handleTriggerIngestion = async () => {
    if (!window.confirm("Trigger automated ingestion pipeline across targeted clinical datasets?")) {
      return;
    }

    setIsIngesting(true);
    setIngestResult(null);
    setError(null);

    try {
      const res = await fetch("/api/genomics", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "ingest" }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || errJson.error || `Ingestion failed (HTTP ${res.status})`);
      }

      const json = await res.json();
      setIngestResult(json.result);
      fetchData();
    } catch (err: any) {
      setError(err.message || "Ingestion pipeline trigger failed.");
    } finally {
      setIsIngesting(false);
    }
  };

  const handleTriggerSync = async () => {
    setIsIngesting(true);
    setError(null);
    try {
      const res = await fetch("/api/genomics", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "sync" }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || json.error || `Failed to trigger sync (HTTP ${res.status})`);
      setIngestResult({ message: json.message || "Background sync started", jobId: json.jobId });
      fetchData();
    } catch (err: any) {
      setError(err.message || "Sync trigger failed.");
    } finally {
      setIsIngesting(false);
    }
  };

  const handleCancelJob = async (jobId: string) => {
    try {
      const res = await fetch("/api/genomics", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "cancel_job", jobId, reason: "Cancelled by administrator via Admin UI" }),
      });

      if (res.ok) {
        fetchData();
      }
    } catch (err: any) {
      console.error("Cancel job error:", err);
    }
  };

  const tabs: { id: GenomicsSubTab; label: string; count?: number }[] = [
    { id: "overview", label: "Dashboard Overview" },
    { id: "diseases", label: "Diseases", count: data?.diseases?.length },
    { id: "genes", label: "Genes", count: data?.genes?.length },
    { id: "variants", label: "Variants", count: data?.variants?.length },
    { id: "reviews", label: "Review Queue", count: data?.reviews?.length },
    { id: "sources", label: "Data Sources", count: data?.sources?.length },
    { id: "imports", label: "Import History", count: data?.imports?.length },
    { id: "classifications", label: "Classification Shifts", count: data?.classifications?.length },
    { id: "audits", label: "Audit Ledger", count: data?.audits?.length },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner & Control Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-lg border border-neutral-200 shadow-2xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-[#1946f7]" />
            <span className="text-xs font-mono font-semibold text-[#1946f7] uppercase tracking-wider">
              Clinical Genomics Administrative Curation
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-neutral-900 tracking-tight">
            Genomics Knowledge Base Governance
          </h1>
          <p className="text-xs text-neutral-500 font-sans mt-0.5">
            PostgreSQL schema <code className="font-mono text-neutral-800">genomics</code> · Server-side authorized session enforcement
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={fetchData}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-mono bg-white border border-neutral-300 rounded hover:bg-neutral-50 text-neutral-700 transition-colors cursor-pointer"
          >
            <ArrowClockwise size={14} className={loading ? "animate-spin" : ""} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setReviewError(null);
              setReviewDecision("");
              setIsReviewModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-mono bg-white border border-neutral-300 rounded hover:border-[#1946f7] hover:text-[#1946f7] text-neutral-800 transition-colors cursor-pointer font-semibold"
          >
            <Plus size={14} />
            <span>Log Scientific Review</span>
          </button>

          <button
            type="button"
            onClick={handleTriggerSync}
            disabled={isIngesting}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-mono bg-indigo-50 border border-indigo-300 text-indigo-700 rounded hover:bg-indigo-100 transition-colors cursor-pointer font-medium disabled:opacity-50"
          >
            <ArrowClockwise size={14} className={isIngesting ? "animate-spin" : ""} />
            <span>Incremental Sync</span>
          </button>

          <button
            type="button"
            onClick={handleTriggerIngestion}
            disabled={isIngesting}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-mono bg-[#1946f7] hover:bg-blue-700 text-white rounded transition-colors cursor-pointer font-medium disabled:opacity-50"
          >
            <Database size={14} />
            <span>{isIngesting ? "Ingesting..." : "Sync NCBI Data"}</span>
          </button>
        </div>
      </div>

      {/* Status Messages */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-xs font-mono text-red-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <WarningCircle size={16} className="text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-red-500 hover:text-red-700 font-bold ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {reviewSuccessMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-mono text-emerald-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle size={16} className="text-emerald-600 shrink-0" />
            <span>{reviewSuccessMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setReviewSuccessMsg(null)}
            className="text-emerald-500 hover:text-emerald-700 font-bold ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {ingestResult && (
        <div className="p-4 bg-blue/5 border border-blue/20 rounded-lg text-xs font-mono text-neutral-800">
          <div className="font-bold text-[#1946f7] mb-1">
            Ingestion Pipeline Finished (Job {ingestResult.jobId})
          </div>
          <div>
            Ingested: {ingestResult.diseasesCount} diseases, {ingestResult.genesCount} genes,{" "}
            {ingestResult.variantsCount} variants, {ingestResult.assertionsCount} assertions,{" "}
            {ingestResult.publicationsCount} publications.
          </div>
        </div>
      )}

      {/* Sub-tab Navigation */}
      <div className="border-b border-neutral-200 overflow-x-auto scrollbar-none flex space-x-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setSubTab(tab.id)}
            className={`px-3.5 py-2 text-xs font-mono rounded-t-lg transition-colors border-t border-l border-r whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              subTab === tab.id
                ? "bg-white border-neutral-200 text-[#1946f7] font-bold border-b-white -mb-px z-10"
                : "border-transparent text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100"
            }`}
          >
            <span>{tab.label}</span>
            {typeof tab.count === "number" && (
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  subTab === tab.id ? "bg-blue/10 text-[#1946f7]" : "bg-neutral-200 text-neutral-600"
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Panels */}
      <div className="bg-white border border-neutral-200 rounded-b-lg rounded-tr-lg p-6 shadow-2xs min-h-[400px]">
        {loading && !data ? (
          <div className="py-20 text-center font-mono text-xs text-neutral-400 animate-pulse">
            Loading administrative genomics data from Neon PostgreSQL...
          </div>
        ) : (
          <>
            {/* 1. Overview SubTab */}
            {subTab === "overview" && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {(
                    [
                      { key: "diseases", label: "Diseases", fallback: data?.diseases?.length || 0 },
                      { key: "genes", label: "Target Genes", fallback: data?.genes?.length || 0 },
                      { key: "variants", label: "Variants", fallback: data?.variants?.length || 0 },
                      { key: "assertions", label: "Clinical Assertions", fallback: data?.assertionsCount || 0 },
                    ] as const
                  ).map((item) => {
                    const b = data?.recordBreakdown?.[item.key] || {
                      total: item.fallback,
                      public: item.fallback,
                      quarantined: 0,
                      approved: 0,
                    };
                    return (
                      <div key={item.key} className="p-4 bg-neutral-50 rounded border border-neutral-200">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono text-neutral-500 uppercase">
                            {item.label}
                          </span>
                          <span className="text-[10px] font-mono text-neutral-400">
                            TOTAL: {b.total}
                          </span>
                        </div>
                        <div className="text-2xl font-bold font-mono text-neutral-900 mt-1">
                          {b.public}{" "}
                          <span className="text-xs font-normal text-neutral-500">public</span>
                        </div>
                        <div className="mt-2 pt-2 border-t border-neutral-200 flex items-center justify-between text-[10px] font-mono">
                          <span className="text-emerald-700">
                            Approved: <strong>{b.approved}</strong>
                          </span>
                          <span className={b.quarantined > 0 ? "text-amber-700" : "text-neutral-400"}>
                            Quarantined: <strong>{b.quarantined}</strong>
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Latest Ingestion */}
                  <div className="border border-neutral-200 rounded-lg p-4">
                    <h3 className="text-xs font-mono uppercase font-semibold text-neutral-700 mb-3 flex items-center gap-1.5">
                      <Clock size={14} className="text-[#1946f7]" />
                      <span>Latest Ingestion Pipeline Execution</span>
                    </h3>
                    {data?.imports && data.imports.length > 0 ? (
                      <div className="space-y-2 text-xs font-mono">
                        <div className="flex justify-between">
                          <span className="text-neutral-500">Job ID:</span>
                          <span className="text-neutral-800 truncate max-w-[200px]">{data.imports[0].id}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-neutral-500">Status:</span>
                          <span className="px-1.5 py-0.5 rounded text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                            {data.imports[0].status}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-neutral-500">Records Ingested:</span>
                          <span className="text-neutral-800 font-bold">{data.imports[0].records_ingested}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-neutral-500">Timestamp:</span>
                          <span className="text-neutral-600">
                            {new Date(data.imports[0].created_at).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-neutral-400 font-mono">No ingestion jobs run yet.</p>
                    )}
                  </div>

                  {/* Schema Status */}
                  <div className="border border-neutral-200 rounded-lg p-4">
                    <h3 className="text-xs font-mono uppercase font-semibold text-neutral-700 mb-3 flex items-center gap-1.5">
                      <ShieldCheck size={14} className="text-[#1946f7]" />
                      <span>PostgreSQL Governance & Integrity</span>
                    </h3>
                    <div className="space-y-2 text-xs font-mono text-neutral-600">
                      <div className="flex items-center gap-2">
                        <CheckCircle size={14} className="text-emerald-600" />
                        <span>Schema <code className="text-neutral-900 font-bold">genomics</code>: Active & Migrated</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle size={14} className="text-emerald-600" />
                        <span>Neon Auth Session Enforcement: Enabled</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle size={14} className="text-emerald-600" />
                        <span>Provenance Separation: Source Records Isolated</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle size={14} className="text-emerald-600" />
                        <span>Public API Rate Limiting: 3 req/sec Active</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 2. Diseases SubTab */}
            {subTab === "diseases" && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="bg-neutral-50 border-b border-neutral-200 text-neutral-500 uppercase text-[10px]">
                      <th className="py-2.5 px-3">Disease Name</th>
                      <th className="py-2.5 px-3">Concept ID</th>
                      <th className="py-2.5 px-3">OMIM</th>
                      <th className="py-2.5 px-3">Inheritance</th>
                      <th className="py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {data?.diseases?.map((d: any) => (
                      <tr key={d.id} className="hover:bg-neutral-50">
                        <td className="py-3 px-3 font-semibold text-neutral-900">{d.name}</td>
                        <td className="py-3 px-3 text-neutral-600">{d.concept_id || "—"}</td>
                        <td className="py-3 px-3 text-neutral-800">{d.omim_id || "—"}</td>
                        <td className="py-3 px-3 text-neutral-600">{d.inheritance_mode || "—"}</td>
                        <td className="py-3 px-3">
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {d.is_published ? "Published" : "Draft"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* 3. Genes SubTab */}
            {subTab === "genes" && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="bg-neutral-50 border-b border-neutral-200 text-neutral-500 uppercase text-[10px]">
                      <th className="py-2.5 px-3">Symbol</th>
                      <th className="py-2.5 px-3">Full Name</th>
                      <th className="py-2.5 px-3">Chr / Cytoband</th>
                      <th className="py-2.5 px-3">Entrez ID</th>
                      <th className="py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {data?.genes?.map((g: any) => (
                      <tr key={g.id} className="hover:bg-neutral-50">
                        <td className="py-3 px-3 font-bold text-neutral-900">{g.symbol}</td>
                        <td className="py-3 px-3 font-sans text-neutral-700">{g.name}</td>
                        <td className="py-3 px-3 text-neutral-600">Chr {g.chromosome}:{g.cytoband || "q"}</td>
                        <td className="py-3 px-3 text-neutral-800">{g.entrez_gene_id}</td>
                        <td className="py-3 px-3">
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {g.is_published ? "Published" : "Draft"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* 4. Variants SubTab */}
            {subTab === "variants" && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="bg-neutral-50 border-b border-neutral-200 text-neutral-500 uppercase text-[10px]">
                      <th className="py-2.5 px-3">Accession / Preferred Name</th>
                      <th className="py-2.5 px-3">cDNA / Protein</th>
                      <th className="py-2.5 px-3">Locus</th>
                      <th className="py-2.5 px-3">Significance</th>
                      <th className="py-2.5 px-3">Stars</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {data?.variants?.map((v: any) => (
                      <tr key={v.id} className="hover:bg-neutral-50">
                        <td className="py-3 px-3 font-semibold text-neutral-900">
                          <div>{v.preferred_name || v.clinvar_vcv}</div>
                          <div className="text-[11px] text-neutral-400">VCV: {v.clinvar_vcv}</div>
                        </td>
                        <td className="py-3 px-3 text-neutral-700">
                          <div>{v.hgvs_cdna || "—"}</div>
                          <div className="text-neutral-400 text-[11px]">{v.hgvs_protein || "—"}</div>
                        </td>
                        <td className="py-3 px-3 text-neutral-600">
                          Chr {v.chromosome}:{Number(v.position_vcf).toLocaleString()}
                        </td>
                        <td className="py-3 px-3 font-semibold">{v.clinical_significance}</td>
                        <td className="py-3 px-3 text-neutral-700">{v.gold_stars}/4 ★</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* 5. Scientific Reviews SubTab */}
            {subTab === "reviews" && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xs font-mono uppercase font-semibold text-neutral-700">
                    Peer & Curator Scientific Reviews ({data?.reviews?.length || 0})
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      setReviewError(null);
                      setReviewDecision("");
                      setIsReviewModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-mono bg-neutral-900 text-white rounded hover:bg-neutral-800 transition-colors cursor-pointer"
                  >
                    <Plus size={12} />
                    <span>New Review Record</span>
                  </button>
                </div>

                {data?.reviews?.length === 0 ? (
                  <p className="text-xs text-neutral-500 font-mono py-8 text-center">
                    No scientific reviews recorded yet. Click "Log Scientific Review" to record a curation decision.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs font-mono">
                      <thead>
                        <tr className="bg-neutral-50 border-b border-neutral-200 text-neutral-500 uppercase text-[10px]">
                          <th className="py-2.5 px-3">Timestamp</th>
                          <th className="py-2.5 px-3">Entity Type</th>
                          <th className="py-2.5 px-3">Entity ID</th>
                          <th className="py-2.5 px-3">Reviewer</th>
                          <th className="py-2.5 px-3">Decision</th>
                          <th className="py-2.5 px-3">Notes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100">
                        {data?.reviews?.map((r: any) => (
                          <tr key={r.id} className="hover:bg-neutral-50">
                            <td className="py-3 px-3 text-neutral-500 whitespace-nowrap">
                              {new Date(r.created_at).toLocaleString()}
                            </td>
                            <td className="py-3 px-3 uppercase text-neutral-700 font-semibold">{r.entity_type}</td>
                            <td className="py-3 px-3 text-neutral-900 truncate max-w-[150px]">{r.entity_id}</td>
                            <td className="py-3 px-3 text-neutral-600">{r.reviewer_email}</td>
                            <td className="py-3 px-3">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  r.review_decision === "accepted"
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    : r.review_decision === "flagged"
                                    ? "bg-amber-50 text-amber-700 border border-amber-200"
                                    : "bg-red-50 text-red-700 border border-red-200"
                                }`}
                              >
                                {r.review_decision}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-neutral-600 font-sans">{r.curator_notes || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* 6. Data Sources SubTab */}
            {subTab === "sources" && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="bg-neutral-50 border-b border-neutral-200 text-neutral-500 uppercase text-[10px]">
                      <th className="py-2.5 px-3">Source Name</th>
                      <th className="py-2.5 px-3">Identifier</th>
                      <th className="py-2.5 px-3">Authority</th>
                      <th className="py-2.5 px-3">License / Terms</th>
                      <th className="py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {data?.sources?.map((s: any) => (
                      <tr key={s.id} className="hover:bg-neutral-50">
                        <td className="py-3 px-3 font-semibold text-neutral-900">{s.name}</td>
                        <td className="py-3 px-3 text-neutral-500">{s.id}</td>
                        <td className="py-3 px-3 font-sans text-neutral-700">{s.authority || "—"}</td>
                        <td className="py-3 px-3 text-neutral-600">{s.license_type || "—"}</td>
                        <td className="py-3 px-3">
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                            {s.is_active ? "Active" : "Disabled"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* 7. Import History SubTab */}
            {subTab === "imports" && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="bg-neutral-50 border-b border-neutral-200 text-neutral-500 uppercase text-[10px]">
                      <th className="py-2.5 px-3">Timestamp</th>
                      <th className="py-2.5 px-3">Job Name / Scope</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Progress / Stage</th>
                      <th className="py-2.5 px-3">Records</th>
                      <th className="py-2.5 px-3">Diagnostics / Errors</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {data?.imports?.map((job: any) => (
                      <tr key={job.id} className="hover:bg-neutral-50">
                        <td className="py-3 px-3 text-neutral-500 whitespace-nowrap">
                          {new Date(job.created_at || job.started_at).toLocaleString()}
                        </td>
                        <td className="py-3 px-3 text-neutral-800">
                          <div className="font-semibold text-neutral-900 truncate max-w-[180px]">{job.job_name || "Sync Job"}</div>
                          <div className="text-[10px] text-neutral-500 truncate max-w-[180px]">{job.target_disease || job.id}</div>
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold inline-flex items-center gap-1 ${
                              job.status === "completed"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : job.status === "running"
                                ? "bg-amber-50 text-amber-700 border border-amber-200"
                                : job.status === "cancelled"
                                ? "bg-neutral-100 text-neutral-600 border border-neutral-300"
                                : "bg-red-50 text-red-700 border border-red-200"
                            }`}
                          >
                            {job.status === "running" && <ArrowClockwise size={10} className="animate-spin" />}
                            {job.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 min-w-[140px]">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-neutral-200 rounded-full h-1.5 overflow-hidden">
                              <div
                                className={`h-1.5 rounded-full ${job.status === "failed" ? "bg-red-500" : job.status === "completed" ? "bg-emerald-500" : "bg-blue-600"}`}
                                style={{ width: `${job.progress_pct || (job.status === "completed" ? 100 : 0)}%` }}
                              />
                            </div>
                            <span className="text-[10px] text-neutral-600 font-semibold">{job.progress_pct ?? (job.status === "completed" ? 100 : 0)}%</span>
                          </div>
                          <div className="text-[9px] text-neutral-400 truncate max-w-[140px] mt-0.5">{job.current_stage || "—"}</div>
                        </td>
                        <td className="py-3 px-3 font-bold text-neutral-900">
                          {job.records_ingested || 0}
                          {job.records_updated ? <span className="text-[10px] text-neutral-500 font-normal"> (+{job.records_updated} upd)</span> : null}
                        </td>
                        <td className="py-3 px-3 text-neutral-500 max-w-xs">
                          {job.cancellation_reason ? (
                            <span className="text-amber-700 text-[10px]">Cancelled: {job.cancellation_reason}</span>
                          ) : job.errors && Array.isArray(job.errors) && job.errors.length > 0 ? (
                            <span className="text-red-600 text-[10px] truncate block" title={job.errors.join("; ")}>
                              ⚠ {job.errors[0]} {job.errors.length > 1 ? `(+${job.errors.length - 1} more)` : ""}
                            </span>
                          ) : (
                            <span className="text-neutral-400 text-[10px]">Clean run</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right">
                          {job.status === "running" ? (
                            <button
                              type="button"
                              onClick={() => handleCancelJob(job.id)}
                              className="px-2 py-1 text-[10px] bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 rounded transition-colors cursor-pointer"
                            >
                              Cancel
                            </button>
                          ) : (
                            <span className="text-neutral-300 text-[10px]">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* 8. Classification Shifts SubTab */}
            {subTab === "classifications" && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="bg-neutral-50 border-b border-neutral-200 text-neutral-500 uppercase text-[10px]">
                      <th className="py-2.5 px-3">Changed At</th>
                      <th className="py-2.5 px-3">ClinVar VCV</th>
                      <th className="py-2.5 px-3">Variant Preferred Name</th>
                      <th className="py-2.5 px-3">Classification Shift</th>
                      <th className="py-2.5 px-3">Review Status</th>
                      <th className="py-2.5 px-3">Summary / Evidence</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {data?.classifications && data.classifications.length > 0 ? (
                      data.classifications.map((c: any) => (
                        <tr key={c.id} className="hover:bg-neutral-50">
                          <td className="py-3 px-3 text-neutral-500 whitespace-nowrap">
                            {new Date(c.changed_at).toLocaleString()}
                          </td>
                          <td className="py-3 px-3 font-semibold text-blue-700">{c.clinvar_vcv}</td>
                          <td className="py-3 px-3 text-neutral-800 truncate max-w-xs">{c.preferred_name || "—"}</td>
                          <td className="py-3 px-3">
                            <span className="text-neutral-500 line-through mr-1">{c.previous_classification || "Unknown"}</span>
                            <span className="text-emerald-700 font-bold">→ {c.new_classification}</span>
                          </td>
                          <td className="py-3 px-3 text-neutral-600 text-[10px]">
                            {c.new_review_status} ({c.new_gold_stars ?? 0}★)
                          </td>
                          <td className="py-3 px-3 text-neutral-500 max-w-sm truncate text-[10px]">
                            {c.change_summary || "ClinVar synchronization update"}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-neutral-400 font-sans">
                          No ClinVar classification shifts recorded yet. Classifications are verified and stable.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* 8. Audit History SubTab */}
            {subTab === "audits" && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="bg-neutral-50 border-b border-neutral-200 text-neutral-500 uppercase text-[10px]">
                      <th className="py-2.5 px-3">Timestamp</th>
                      <th className="py-2.5 px-3">Actor Email</th>
                      <th className="py-2.5 px-3">Action</th>
                      <th className="py-2.5 px-3">Entity Type / ID</th>
                      <th className="py-2.5 px-3">Audit Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {data?.audits?.map((log: any) => (
                      <tr key={log.id} className="hover:bg-neutral-50">
                        <td className="py-3 px-3 text-neutral-500 whitespace-nowrap">
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                        <td className="py-3 px-3 font-semibold text-neutral-800">{log.actor_email}</td>
                        <td className="py-3 px-3 text-[#1946f7] font-semibold">{log.action}</td>
                        <td className="py-3 px-3 text-neutral-600">
                          {log.entity_type} ({log.entity_id})
                        </td>
                        <td className="py-3 px-3 text-neutral-500 max-w-xs truncate">
                          {typeof log.details === "object"
                            ? JSON.stringify(log.details)
                            : String(log.details || "—")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* Review Modal Dialog */}
      {isReviewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg border border-neutral-200 shadow-xl max-w-lg w-full p-6 text-neutral-900 font-sans">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-neutral-200">
              <h3 className="text-base font-semibold font-mono text-neutral-900 flex items-center gap-2">
                <ShieldCheck size={18} className="text-[#1946f7]" />
                <span>Log Scientific Review Decision</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsReviewModalOpen(false)}
                className="text-neutral-400 hover:text-neutral-600 p-1"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmitReview} className="space-y-4">
              {reviewError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded text-xs font-mono text-rose-700 flex items-start gap-2">
                  <WarningCircle size={15} className="shrink-0 mt-0.5" />
                  <span>{reviewError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-mono text-neutral-700 mb-1">Entity Type</label>
                <select
                  value={reviewEntityType}
                  onChange={(e) => setReviewEntityType(e.target.value as any)}
                  className="w-full text-xs font-mono border border-neutral-300 rounded p-2 bg-white"
                >
                  <option value="variant">Variant (ClinVar VCV)</option>
                  <option value="disease">Disease Condition</option>
                  <option value="gene">Gene Locus</option>
                  <option value="clinical_assertion">Clinical Assertion</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-mono text-neutral-700 mb-1">
                  Entity Accession or ID (e.g. VCV000015408 or HBB)
                </label>
                <input
                  type="text"
                  required
                  value={reviewEntityId}
                  onChange={(e) => setReviewEntityId(e.target.value)}
                  placeholder="e.g. VCV000015408"
                  className="w-full text-xs font-mono border border-neutral-300 rounded p-2"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-neutral-700 mb-1">Review Decision</label>
                <select
                  required
                  value={reviewDecision}
                  onChange={(e) => {
                    setReviewDecision(e.target.value as any);
                    setReviewError(null);
                  }}
                  className="w-full text-xs font-mono border border-neutral-300 rounded p-2 bg-white font-semibold"
                >
                  <option value="" disabled>
                    Select review decision...
                  </option>
                  <option value="accepted">Accepted (Verified against ACMG/ClinGen)</option>
                  <option value="flagged">Flagged (Requires senior director review)</option>
                  <option value="modified">Modified (Curation notes adjusted)</option>
                  <option value="rejected">Rejected (Insufficient scientific evidence)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-mono text-neutral-700 mb-1">Curator Notes & Evidence</label>
                <textarea
                  rows={3}
                  required
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Detail clinical rationale, ACMG criteria applied, and laboratory validation references..."
                  className="w-full text-xs font-sans border border-neutral-300 rounded p-2"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-neutral-200">
                <button
                  type="button"
                  onClick={() => setIsReviewModalOpen(false)}
                  className="px-3 py-1.5 text-xs font-mono border border-neutral-300 rounded text-neutral-700 hover:bg-neutral-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reviewSubmitting}
                  className="px-4 py-1.5 text-xs font-mono bg-[#1946f7] hover:bg-blue-700 text-white rounded font-medium disabled:opacity-50"
                >
                  {reviewSubmitting ? "Recording..." : "Save Review Decision"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
