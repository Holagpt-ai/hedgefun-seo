import { createServerClient } from "@/lib/supabase";

const BASE_URL = "https://hedgefun.fun";
const PAGE_SIZE = 1000;

export async function GET() {
  const supabase = createServerClient();
  const today = new Date().toISOString().split("T")[0];

  // Count each type
  const [stocksResult, etfsResult, iposResult, newsResult] = await Promise.all([
    supabase
      .from("seo_tickers")
      .select("*", { count: "exact", head: true })
      .eq("type", "stock"),
    supabase
      .from("seo_tickers")
      .select("*", { count: "exact", head: true })
      .eq("type", "etf"),
    supabase
      .from("seo_tickers")
      .select("*", { count: "exact", head: true })
      .eq("type", "ipo"),
    supabase
      .from("seo_news")
      .select("*", { count: "exact", head: true })
      .not("slug", "is", null),
  ]);

  const stockPages = Math.ceil((stocksResult.count ?? 0) / PAGE_SIZE);
  const etfPages = Math.ceil((etfsResult.count ?? 0) / PAGE_SIZE);
  const ipoPages = Math.ceil((iposResult.count ?? 0) / PAGE_SIZE);
  const newsPages = Math.ceil((newsResult.count ?? 0) / PAGE_SIZE);

  const buildEntries = (base: string, pages: number) =>
    Array.from({ length: Math.max(pages, 1) }, (_, i) =>
      `  <sitemap>\n    <loc>${BASE_URL}/${base}/${i + 1}</loc>\n    <lastmod>${today}</lastmod>\n  </sitemap>`
    ).join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${BASE_URL}/sitemap.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${BASE_URL}/sitemap-static</loc>
    <lastmod>${today}</lastmod>
  </sitemap>
${buildEntries("sitemap-stocks", stockPages)}
${buildEntries("sitemap-etfs", etfPages)}
${buildEntries("sitemap-ipos", ipoPages)}
${newsPages > 0 ? buildEntries("sitemap-news", newsPages) : ""}
</sitemapindex>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
