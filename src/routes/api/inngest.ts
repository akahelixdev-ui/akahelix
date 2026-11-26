import { createFileRoute } from "@tanstack/react-router";
import { serve } from "inngest/edge";
import { inngest } from "@/genomics/services/inngest/client";
import { genomicsSyncFunctions } from "@/genomics/services/inngest/functions";

// ============================================================================
// Inngest Endpoint for AKAHELIX Genomics
// Handles scheduled cron syncs, durable background ingestion, and cancellation.
// ============================================================================

const isDev =
  process.env["NODE_ENV"] !== "production" &&
  process.env["INNGEST_DEV"] === "1";

const handler = serve({
  client: inngest,
  functions: genomicsSyncFunctions,
  ...(isDev ? { isDev: true } : {}),
  ...(process.env["INNGEST_SIGNING_KEY"]
    ? { signingKey: process.env["INNGEST_SIGNING_KEY"] }
    : {}),
});

export const Route = createFileRoute("/api/inngest")({
  server: {
    handlers: {
      GET: async ({ request }) => handler(request),
      POST: async ({ request }) => handler(request),
      PUT: async ({ request }) => handler(request),
    },
  },
});
