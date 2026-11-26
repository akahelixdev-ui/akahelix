import { Inngest } from "inngest";

// ============================================================================
// AKAHELIX Inngest Client
// Provides durable execution, scheduled incremental sync, automatic retries,
// and background processing outside synchronous HTTP cycles.
// ============================================================================

export type InngestEvents = {
  "genomics/sync.requested": {
    data: {
      jobId: string;
      config?: {
        geneSymbols?: string[];
        diseaseSlugs?: string[];
        maxVariantsPerGene?: number;
      };
      source?: string;
    };
  };
  "genomics/sync.scheduled": {
    data: {
      scheduledAt: string;
      syncType: "incremental" | "full";
    };
  };
  "genomics/sync.cancelled": {
    data: {
      jobId: string;
      reason?: string;
    };
  };
};

const eventKey = process.env["INNGEST_EVENT_KEY"];
const isDev =
  process.env["NODE_ENV"] !== "production" &&
  process.env["INNGEST_DEV"] === "1";

export const inngest = new Inngest({
  id: "akahelix-genomics",
  ...(eventKey ? { eventKey } : {}),
  ...(isDev ? { isDev: true } : {}),
});
