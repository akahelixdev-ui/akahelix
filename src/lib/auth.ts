import { createAuthClient } from "@neon/auth";

// Automatically target the active staging or production Neon Auth instance
const defaultStagingAuthUrl =
  "https://ep-little-surf-beun7bf0.neonauth.c-9.us-east-2.aws.neon.tech/neondb/auth";

const authUrl =
  (typeof import.meta !== "undefined" && import.meta.env?.["VITE_NEON_AUTH_URL"]) ||
  process.env["NEON_AUTH_BASE_URL"] ||
  defaultStagingAuthUrl;

export const authClient = createAuthClient(authUrl);
