import { neon } from "@neondatabase/serverless";

function getSql() {
  const url = process.env["DATABASE_URL"];
  if (!url) throw new Error("DATABASE_URL is not set.");
  return neon(url);
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string | null;
  role: string | null;
  sessionToken: string;
}

/**
 * Validates a session token directly against Neon Auth tables (neon_auth.session & neon_auth.user).
 * Ensures server-side verification without trusting client-side claims or localStorage.
 */
export async function validateSessionToken(token: string): Promise<AuthenticatedUser | null> {
  if (!token || typeof token !== "string" || token.trim().length === 0) {
    return null;
  }

  const sql = getSql();

  try {
    const rows = await sql`
      SELECT 
        u.id,
        u.email,
        u.name,
        u.role,
        u.banned,
        s.token,
        s."expiresAt"
      FROM neon_auth.session s
      JOIN neon_auth."user" u ON s."userId" = u.id
      WHERE s.token = ${token.trim()}
        AND s."expiresAt" > NOW()
        AND (u.banned IS FALSE OR u.banned IS NULL)
      LIMIT 1
    `;

    if (!rows || rows.length === 0) {
      return null;
    }

    const row = rows[0] as {
      id: string;
      email: string;
      name: string | null;
      role: string | null;
      token: string;
    };

    return {
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role,
      sessionToken: row.token,
    };
  } catch (err) {
    console.error("Error validating session token against Neon Auth:", err);
    return null;
  }
}

/**
 * Extracts a session token from HTTP Request headers (Authorization Bearer or Cookie).
 */
export function extractTokenFromRequest(request: Request): string | null {
  // 1. Authorization: Bearer <token>
  const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
  if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.slice(7).trim();
    if (token) return token;
  }

  // 2. Cookie header parsing
  const cookieHeader = request.headers.get("cookie") || request.headers.get("Cookie");
  if (cookieHeader) {
    const cookies = cookieHeader.split(";").map((c) => c.trim());
    for (const cookie of cookies) {
      const [key, ...rest] = cookie.split("=");
      const val = rest.join("=");
      if (
        key === "neon_auth_token" ||
        key === "neon_session" ||
        key === "auth_token" ||
        key === "__session" ||
        key === "session_token"
      ) {
        if (val) return decodeURIComponent(val);
      }
    }
  }

  // 3. Custom header
  const customHeader = request.headers.get("x-neon-session-token");
  if (customHeader) return customHeader.trim();

  return null;
}

export type GenomicsRole = "admin" | "curator" | "director";

/**
 * Defense-in-depth CSRF check for state-changing requests.
 * If a browser Origin header is present, verify its host matches the request host.
 */
export function assertSameOriginIfBrowser(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin) return;
  try {
    const originHost = new URL(origin).host;
    const reqHost = new URL(request.url).host;
    if (originHost !== reqHost) {
      throw new Response(
        JSON.stringify({
          error: "CSRF_FORBIDDEN",
          message: "Cross-origin state-changing request rejected.",
        }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }
  } catch (err) {
    if (err instanceof Response) throw err;
    throw new Response(
      JSON.stringify({ error: "CSRF_FORBIDDEN", message: "Invalid Origin header." }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }
}

/**
 * Verifies that the incoming request has a valid authenticated session from an authorized user
 * with explicit server-verified roles (admin, curator, or director).
 * Email-domain heuristics (e.g. @akahelix.com) are strictly prohibited.
 */
export async function assertAdminSession(
  request: Request,
  allowedRoles: GenomicsRole[] = ["admin", "curator", "director"]
): Promise<AuthenticatedUser> {
  const token = extractTokenFromRequest(request);
  if (!token) {
    throw new Response(
      JSON.stringify({
        error: "UNAUTHORIZED",
        message: "Authentication required. No valid session token provided.",
      }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  const user = await validateSessionToken(token);
  if (!user) {
    throw new Response(
      JSON.stringify({
        error: "INVALID_SESSION",
        message: "Session token is invalid, expired, or user account is inactive.",
      }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  // Strict role verification: Role MUST be explicitly assigned in the database
  const userRole = (user.role || "").toLowerCase() as GenomicsRole;
  const hasRequiredRole = allowedRoles.includes(userRole);

  if (!hasRequiredRole) {
    throw new Response(
      JSON.stringify({
        error: "FORBIDDEN",
        message: `Access denied. Insufficient administrative privileges. Required role: ${allowedRoles.join(" or ")}, but user role is '${user.role || "none"}'.`,
      }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }

  return user;
}
