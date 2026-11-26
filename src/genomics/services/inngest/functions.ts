import { inngest } from "./client";
import { runIncrementalSync } from "../sync/incremental_sync";
import { neon } from "@neondatabase/serverless";

function getSql() {
  const url = process.env["DATABASE_URL"];
  if (!url) throw new Error("DATABASE_URL is required for inngest functions.");
  return neon(url);
}

/**
 * Daily scheduled incremental synchronization cron job.
 * Executes at 03:00 UTC every day to pull incremental updates from
 * NCBI Gene, ClinVar, MedGen, PubMed, HGNC, and HPO.
 */
export const scheduledGenomicsSync = inngest.createFunction(
  {
    id: "nightly-genomics-incremental-sync",
    name: "Nightly Genomics Scientific Data Synchronization",
    concurrency: {
      limit: 1, // Only 1 sync running at any given time
    },
    retries: 3,
    triggers: [{ cron: "0 3 * * *" }],
  },
  async ({ step }: { step: any }) => {
    const result = await step.run("execute-incremental-sync", async () => {
      const syncResult = await runIncrementalSync({
        jobName: `Scheduled-Sync-${new Date().toISOString().split("T")[0]}`,
        syncType: "incremental",
      });

      if (syncResult.status === "failed") {
        throw new Error(
          `Scheduled incremental sync failed: ${syncResult.errors?.join("; ") || "Unknown error"}`
        );
      }

      return syncResult;
    });

    if (result.status === "cancelled") {
      return { success: false, cancelled: true, result };
    }

    return { success: true, result };
  }
);

/**
 * Durable on-demand background sync worker.
 * Triggered asynchronously by admin action, API webhook, or dataset import event.
 * Runs outside synchronous HTTP cycles to prevent gateway timeouts.
 */
export const durableSyncWorker = inngest.createFunction(
  {
    id: "durable-genomics-sync-worker",
    name: "Durable Genomics Sync Worker",
    concurrency: {
      limit: 1,
    },
    cancelOn: [
      {
        event: "genomics/sync.cancelled",
        match: "data.jobId",
      },
    ],
    retries: 3,
    triggers: [{ event: "genomics/sync.requested" }],
  },
  async ({ event, step }: { event: any; step: any }) => {
    const { jobId, config } = event.data || {};

    const result = await step.run("run-sync-pipeline", async () => {
      const syncResult = await runIncrementalSync(config || {}, jobId);

      if (syncResult.status === "failed") {
        throw new Error(
          `Incremental sync failed for job ${syncResult.jobId}: ${syncResult.errors?.join("; ") || "Unknown error"}`
        );
      }

      return syncResult;
    });

    if (result.status === "cancelled") {
      return { success: false, cancelled: true, jobId, result };
    }

    return { success: true, jobId, result };
  }
);

/**
 * Handle sync cancellation event.
 */
export const handleSyncCancellation = inngest.createFunction(
  {
    id: "handle-sync-cancellation",
    name: "Handle Genomics Sync Cancellation",
    triggers: [{ event: "genomics/sync.cancelled" }],
  },
  async ({ event, step }: { event: any; step: any }) => {
    const { jobId, reason } = event.data || {};

    await step.run("mark-job-cancelled", async () => {
      const sql = getSql();
      await sql`
        UPDATE genomics.import_jobs
        SET status = 'cancelled',
            cancelled_at = NOW(),
            cancellation_reason = ${reason || "Cancelled by administrator via Inngest event"},
            current_stage = 'cancelled'
        WHERE id = ${jobId}
      `;
    });

    return { success: true, jobId, cancelled: true };
  }
);

export const genomicsSyncFunctions = [
  scheduledGenomicsSync,
  durableSyncWorker,
  handleSyncCancellation,
];
