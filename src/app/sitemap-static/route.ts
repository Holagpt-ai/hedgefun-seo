const BASE_URL = "https://seo.hedgefun.fun";

const STATIC_PAGES = [
  { path: "/", priority: 1.0, changefreq: "daily" },
  { path: "/stocks", priority: 0.9, changefreq: "daily" },
  { path: "/etfs", priority: 0.9, changefreq: "daily" },
  { path: "/ipos", priority: 0.8, changefreq: "daily" },
  { path: "/screener", priority: 0.8, changefreq: "daily" },
  { path: "/news", priority: 0.8, changefreq: "hourly" },
  { path: "/earnings", priority: 0.7, changefreq: "daily" },
  { path: "/movers", priority: 0.7, changefreq: "hourly" },
  { path: "/trending", priority: 0.6, changefreq: "daily" },
  { path: "/pro", priority: 0.6, changefreq: "monthly" },
  { path: "/about", priority: 0.4, changefreq: "monthly" },
  { path: "/privacy", priority: 0.2, changefreq: "yearly" },
  { path: "/terms", priority: 0.2, changefreq: "yearly" },
];

export async function GET() {
  const today = new Date().toISOString().split("T")[0];

  const urls = STATIC_PAGES.flatMap(({ path, priority, changefreq }) => [
    `\n  <url>\n    <loc>${BASE_URL}${path}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`,
    `\n  <url>\n    <loc>${BASE_URL}/es${path}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${Math.max(priority - 0.1, 0.1)}</priority>\n  </url>`,
  ]).join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    },
  });
}
