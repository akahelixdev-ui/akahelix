import { createFileRoute } from "@tanstack/react-router";

const publicRoutes = [
  { path: "", priority: "1.0", changefreq: "weekly" },
  { path: "/services", priority: "0.9", changefreq: "monthly" },
  { path: "/services/bring-send-outs-in-house", priority: "0.8", changefreq: "monthly" },
  { path: "/services/feasibility-and-laboratory-design", priority: "0.8", changefreq: "monthly" },
  { path: "/services/licensing-and-regulatory-pathway", priority: "0.8", changefreq: "monthly" },
  { path: "/services/assay-validation-and-verification", priority: "0.8", changefreq: "monthly" },
  { path: "/services/quality-management-system", priority: "0.8", changefreq: "monthly" },
  { path: "/services/inspection-readiness", priority: "0.8", changefreq: "monthly" },
  { path: "/services/interpretation-and-reporting", priority: "0.8", changefreq: "monthly" },
  { path: "/services/staff-training-and-handover", priority: "0.8", changefreq: "monthly" },
  { path: "/approach", priority: "0.8", changefreq: "monthly" },
  { path: "/track-record", priority: "0.8", changefreq: "monthly" },
  { path: "/founder", priority: "0.8", changefreq: "monthly" },
  { path: "/book", priority: "0.7", changefreq: "monthly" },
  { path: "/leadership", priority: "0.7", changefreq: "monthly" },
  { path: "/contact", priority: "0.7", changefreq: "monthly" },
];

const currentDate = new Date().toISOString().split("T")[0];

export function generateSitemapXml(baseUrl = "https://www.akahelix.com"): string {
  const urls = publicRoutes
    .map(
      (route) => `  <url>
    <loc>${baseUrl}${route.path ? route.path : "/"}</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>${route.changefreq}</changefreq>
    <priority>${route.priority}</priority>
  </url>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: () => {
        const xml = generateSitemapXml();
        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=86400, s-maxage=86400",
          },
        });
      },
    },
  },
});
