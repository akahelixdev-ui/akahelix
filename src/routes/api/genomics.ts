import { createFileRoute } from "@tanstack/react-router";
import {
  getGenomicsOverviewStats,
  getGenomicsAnalytics,
  exportPublicGenomicsRecords,
  getDiseases,
  getDiseaseByIdOrSlug,
  getGenes,
  getGeneByIdOrSymbol,
  getVariants,
  getVariantByIdOrVcv,
  searchGenomics,
  getResearchPublications,
  createScientificReview,
  ReviewValidationError,
  getAdminGenomicsOverview,
  getImportJobsAndCheckpoints,
  getClassificationHistory,
  cancelImportJob,
  type SearchCategory,
} from "@/genomics/db/client";
import { assertAdminSession, assertSameOriginIfBrowser } from "@/genomics/services/auth.server";
import { runIngestionPipeline } from "@/genomics/services/ingestion/pipeline";
import { runDynamicIngestion } from "@/genomics/services/ingestion/dynamic_engine";
import { inngest } from "@/genomics/services/inngest/client";
import { neon } from "@neondatabase/serverless";

function getSql() {
  const url = process.env["DATABASE_URL"];
  if (!url) throw new Error("DATABASE_URL is required");
  return neon(url);
}

export const Route = createFileRoute("/api/genomics")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const action = url.searchParams.get("action") || "overview";

        try {
          if (action === "overview") {
            const stats = await getGenomicsOverviewStats();
            return Response.json(stats);
          }

          if (action === "diseases") {
            const page = parseInt(url.searchParams.get("page") || "1", 10);
            const limit = parseInt(url.searchParams.get("limit") || "20", 10);
            const search = url.searchParams.get("search") || undefined;
            const inheritance = url.searchParams.get("inheritance") || undefined;
            const res = await getDiseases({ page, limit, search, inheritance });
            return Response.json(res);
          }

          if (action === "disease") {
            const id = url.searchParams.get("id");
            if (!id) return Response.json({ error: "Missing 'id' parameter" }, { status: 400 });
            const item = await getDiseaseByIdOrSlug(id);
            if (!item) return Response.json({ error: "Disease not found" }, { status: 404 });
            return Response.json(item);
          }

          if (action === "genes") {
            const page = parseInt(url.searchParams.get("page") || "1", 10);
            const limit = parseInt(url.searchParams.get("limit") || "20", 10);
            const search = url.searchParams.get("search") || undefined;
            const chromosome = url.searchParams.get("chromosome") || undefined;
            const res = await getGenes({ page, limit, search, chromosome });
            return Response.json(res);
          }

          if (action === "gene") {
            const id = url.searchParams.get("id");
            if (!id) return Response.json({ error: "Missing 'id' parameter" }, { status: 400 });
            const item = await getGeneByIdOrSymbol(id);
            if (!item) return Response.json({ error: "Gene not found" }, { status: 404 });
            return Response.json(item);
          }

          if (action === "variants") {
            const page = parseInt(url.searchParams.get("page") || "1", 10);
            const limit = parseInt(url.searchParams.get("limit") || "20", 10);
            const search = url.searchParams.get("search") || undefined;
            const significance = url.searchParams.get("significance") || undefined;
            const chromosome = url.searchParams.get("chromosome") || undefined;
            const geneSymbol = url.searchParams.get("gene") || undefined;
            const res = await getVariants({ page, limit, search, significance, chromosome, geneSymbol });
            return Response.json(res);
          }

          if (action === "variant") {
            const id = url.searchParams.get("id");
            if (!id) return Response.json({ error: "Missing 'id' parameter" }, { status: 400 });
            const item = await getVariantByIdOrVcv(id);
            if (!item) return Response.json({ error: "Variant not found" }, { status: 404 });
            return Response.json(item);
          }

          if (action === "search") {
            const q = url.searchParams.get("q") || "";
            const category = (url.searchParams.get("category") || "all") as SearchCategory;
            const significance = url.searchParams.get("significance") || undefined;
            const chromosome = url.searchParams.get("chromosome") || undefined;
            const inheritance = url.searchParams.get("inheritance") || undefined;
            const evidenceLevel = url.searchParams.get("evidenceLevel") || undefined;
            const reviewStatus = url.searchParams.get("reviewStatus") || undefined;
            const res = await searchGenomics(q, {
              category,
              significance,
              chromosome,
              inheritance,
              evidenceLevel,
              reviewStatus,
            });
            return Response.json(res);
          }

          if (action === "analytics") {
            const analytics = await getGenomicsAnalytics();
            return Response.json(analytics);
          }

          if (action === "export") {
            const format = url.searchParams.get("format") === "json" ? "json" : "csv";
            const entity = (url.searchParams.get("entity") || "all") as SearchCategory;
            const q = url.searchParams.get("q") || undefined;
            const significance = url.searchParams.get("significance") || undefined;
            const chromosome = url.searchParams.get("chromosome") || undefined;
            const inheritance = url.searchParams.get("inheritance") || undefined;
            const evidenceLevel = url.searchParams.get("evidenceLevel") || undefined;
            const reviewStatus = url.searchParams.get("reviewStatus") || undefined;
            const exported = await exportPublicGenomicsRecords({
              format,
              entity,
              q,
              significance,
              chromosome,
              inheritance,
              evidenceLevel,
              reviewStatus,
            });
            return new Response(exported.body, {
              status: 200,
              headers: {
                "Content-Type": exported.contentType,
                "Content-Disposition": `attachment; filename="${exported.filename}"`,
              },
            });
          }

          if (action === "publications") {
            const page = parseInt(url.searchParams.get("page") || "1", 10);
            const limit = parseInt(url.searchParams.get("limit") || "20", 10);
            const search = url.searchParams.get("search") || undefined;
            const res = await getResearchPublications({ page, limit, search });
            return Response.json(res);
          }

          if (action === "admin_overview") {
            // Require server-side authentication for admin, curator, or director
            await assertAdminSession(request, ["admin", "curator", "director"]);
            const overview = await getAdminGenomicsOverview();
            return Response.json(overview);
          }

          if (action === "import_jobs") {
            await assertAdminSession(request, ["admin", "curator", "director"]);
            const jobId = url.searchParams.get("jobId") || undefined;
            const res = await getImportJobsAndCheckpoints(jobId);
            return Response.json(res);
          }

          if (action === "classifications") {
            await assertAdminSession(request, ["admin", "curator", "director"]);
            const limit = parseInt(url.searchParams.get("limit") || "50", 10);
            const res = await getClassificationHistory(limit);
            return Response.json({ items: res });
          }

          return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
        } catch (err: any) {
          if (err instanceof Response) return err;
          console.error("API /api/genomics GET error:", err);
          return Response.json({ error: err.message || "Internal server error" }, { status: 500 });
        }
      },

      POST: async ({ request }) => {
        try {
          assertSameOriginIfBrowser(request);
          const body = await request.json();
          const action = body.action;

          if (action === "review") {
            // Enforce server-side authorization check against neon_auth (admin, curator, or director)
            const user = await assertAdminSession(request, ["admin", "curator", "director"]);
            const { entityType, entityId, decision, notes, proposedChanges } = body;

            if (!entityType || !entityId || !decision) {
              return Response.json(
                { error: "Missing required review fields (entityType, entityId, decision)" },
                { status: 400 }
              );
            }

            const review = await createScientificReview({
              entityType,
              entityId,
              reviewerEmail: user.email,
              reviewerName: user.name || user.email.split("@")[0],
              reviewDecision: decision,
              curatorNotes: notes || "",
              proposedChanges,
            });

            return Response.json({ success: true, review });
          }

          if (action === "ingest") {
            // Enforce server-side authorization check (only admin or director can trigger data ingestion)
            await assertAdminSession(request, ["admin", "director"]);
            const result = await runIngestionPipeline();
            return Response.json({ success: true, result });
          }

          if (action === "dynamic_ingest") {
            // Enforce server-side authorization check (only admin or director)
            await assertAdminSession(request, ["admin", "director"]);
            const { config, async: runAsync = true } = body;
            if (!config || !Array.isArray(config.conditions)) {
              return Response.json({ error: "Missing or invalid 'config.conditions' array in dynamic_ingest request." }, { status: 400 });
            }

            if (runAsync === false) {
              const result = await runDynamicIngestion(config);
              return Response.json({ success: true, result });
            }

            // Move long-running imports outside synchronous API requests
            const sql = getSql();
            const [job] = await sql`
              INSERT INTO genomics.import_jobs (
                job_name, target_disease, status, job_type, records_ingested, records_updated,
                progress_pct, current_stage, config, started_at, created_at
              )
              VALUES (
                ${config.jobName || "Dynamic-Genomics-Ingestion"},
                ${config.conditions.map((c: any) => c.name).join(", ").slice(0, 200)},
                'running', 'dynamic_ingest', 0, 0, 5, 'queued',
                ${JSON.stringify(config)}::jsonb,
                NOW(), NOW()
              )
              RETURNING id
            `;
            const jobId = (job as any).id;

            // Execute dynamic ingestion
            runDynamicIngestion(config, jobId).catch((err) => {
              console.error(`[Background Ingestion] Job ${jobId} failed:`, err);
            });

            return Response.json({
              success: true,
              jobId,
              status: "queued",
              message: "Dynamic ingestion initiated in background. Track progress via /api/genomics?action=import_jobs",
            }, { status: 202 });
          }

          if (action === "sync") {
            await assertAdminSession(request, ["admin", "director"]);
            const { config = {} } = body;
            const sql = getSql();

            const [job] = await sql`
              INSERT INTO genomics.import_jobs (
                job_name, target_disease, status, job_type, records_ingested, records_updated,
                progress_pct, current_stage, config, started_at, created_at
              )
              VALUES (
                ${config.jobName || "Automated-Incremental-Sync"},
                'Active Curated Repertoire',
                'running', 'incremental_sync', 0, 0, 5, 'queued',
                ${JSON.stringify(config)}::jsonb,
                NOW(), NOW()
              )
              RETURNING id
            `;
            const jobId = (job as any).id;

            // Dispatch strictly through durable Inngest worker (no unsafe in-process fallback)
            try {
              await inngest.send({
                name: "genomics/sync.requested",
                data: { jobId, config, source: "admin_trigger" },
              });
            } catch (inngestErr: any) {
              const errMsg = `Inngest dispatch failed: ${inngestErr?.message || "Event bus unavailable"}`;
              await sql`
                UPDATE genomics.import_jobs
                SET status = 'failed',
                    current_stage = 'dispatch_failed',
                    errors = ${JSON.stringify([errMsg])}::jsonb,
                    completed_at = NOW()
                WHERE id = ${jobId}
              `;
              return Response.json(
                {
                  success: false,
                  jobId,
                  error: "INNGEST_UNAVAILABLE",
                  message: errMsg,
                },
                { status: 503 }
              );
            }

            return Response.json({
              success: true,
              jobId,
              status: "queued",
              executor: "inngest",
              message: "Incremental synchronization initiated via durable Inngest worker.",
            }, { status: 202 });
          }

          if (action === "cancel_job") {
            const user = await assertAdminSession(request, ["admin", "director"]);
            const { jobId, reason } = body;
            if (!jobId) {
              return Response.json({ error: "Missing required 'jobId' field." }, { status: 400 });
            }

            await cancelImportJob(jobId, reason, user.email);

            // Send durable cancellation event to Inngest
            await inngest.send({
              name: "genomics/sync.cancelled",
              data: { jobId, reason },
            }).catch(() => {});

            return Response.json({ success: true, message: "Job cancellation signal registered." });
          }

          return Response.json({ error: `Unknown POST action: ${action}` }, { status: 400 });
        } catch (err: any) {
          if (err instanceof Response) return err;
          if (err instanceof ReviewValidationError) {
            return Response.json(
              { error: err.code, message: err.message },
              { status: err.status }
            );
          }
          console.error("API /api/genomics POST error:", err);
          return Response.json({ error: err.message || "Internal server error" }, { status: 500 });
        }
      },
    },
  },
});
