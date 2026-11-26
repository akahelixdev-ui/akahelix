import { createFileRoute } from "@tanstack/react-router";
import {
  assertSameOriginIfBrowser,
  extractTokenFromRequest,
  validateSessionToken,
  type GenomicsRole,
} from "@/genomics/services/auth.server";

const ALLOWED_ROLES: GenomicsRole[] = ["admin", "curator", "director"];

function buildSessionCookie(token: string, request: Request, maxAgeSeconds = 604800): string {
  const isHttps = new URL(request.url).protocol === "https:";
  const parts = [
    `neon_auth_token=${encodeURIComponent(token)}`,
    `Path=/`,
    `HttpOnly`,
    `SameSite=Lax`,
    `Max-Age=${maxAgeSeconds}`,
  ];
  if (isHttps) {
    parts.push("Secure");
  }
  return parts.join("; ");
}

export const Route = createFileRoute("/api/auth/session")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const token = extractTokenFromRequest(request);
          if (!token) {
            return Response.json({ authenticated: false, user: null }, { status: 401 });
          }

          const user = await validateSessionToken(token);
          if (!user) {
            return Response.json({ authenticated: false, user: null }, { status: 401 });
          }

          const role = (user.role || "").toLowerCase() as GenomicsRole;
          if (!ALLOWED_ROLES.includes(role)) {
            return Response.json(
              {
                authenticated: false,
                error: "FORBIDDEN",
                message: `Insufficient administrative privileges. Required role: ${ALLOWED_ROLES.join(" or ")}.`,
              },
              { status: 403 }
            );
          }

          return Response.json({
            authenticated: true,
            user: {
              id: user.id,
              email: user.email,
              name: user.name,
              role: user.role,
            },
          });
        } catch (err: any) {
          console.error("GET /api/auth/session error:", err);
          return Response.json({ authenticated: false, error: "Internal server error" }, { status: 500 });
        }
      },

      POST: async ({ request }) => {
        try {
          assertSameOriginIfBrowser(request);
          const body = await request.json().catch(() => ({}));
          let token =
            typeof body?.token === "string" && body.token.trim().length > 0
              ? body.token.trim()
              : null;

          if (!token) {
            token = extractTokenFromRequest(request);
          }

          if (!token) {
            return Response.json(
              { authenticated: false, error: "UNAUTHORIZED", message: "Missing session token." },
              { status: 401 }
            );
          }

          const user = await validateSessionToken(token);
          if (!user) {
            return Response.json(
              {
                authenticated: false,
                error: "INVALID_SESSION",
                message: "Session token is invalid, expired, or user account is inactive.",
              },
              { status: 401 }
            );
          }

          const role = (user.role || "").toLowerCase() as GenomicsRole;
          if (!ALLOWED_ROLES.includes(role)) {
            return Response.json(
              {
                authenticated: false,
                error: "FORBIDDEN",
                message: `Access denied. Required role: ${ALLOWED_ROLES.join(" or ")}, but user role is '${user.role || "none"}'.`,
              },
              { status: 403 }
            );
          }

          return Response.json(
            {
              authenticated: true,
              user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
              },
            },
            {
              status: 200,
              headers: {
                "Set-Cookie": buildSessionCookie(user.sessionToken, request),
              },
            }
          );
        } catch (err: any) {
          console.error("POST /api/auth/session error:", err);
          return Response.json({ authenticated: false, error: "Internal server error" }, { status: 500 });
        }
      },

      DELETE: async ({ request }) => {
        try {
          assertSameOriginIfBrowser(request);
          return Response.json(
            { authenticated: false },
            {
              status: 200,
              headers: {
                "Set-Cookie": buildSessionCookie("", request, 0),
              },
            }
          );
        } catch (err: any) {
          if (err instanceof Response) return err;
          return Response.json({ authenticated: false, error: "Internal server error" }, { status: 500 });
        }
      },
    },
  },
});
