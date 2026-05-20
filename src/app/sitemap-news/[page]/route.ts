import { createServerClient } from "@/lib/supabase";
import { NextRequest } from "next/server";

const BASE_URL = "https://seo.hedgefun.fun";
const PAGE_SIZE = 1000;

export async function GET(
  request: NextRequest,
  { params }: { params: { page: string } }
) {
  const page = parseInt(params.page, 10);
  if (isNaN(page) || page < 1) {
    return new Response("Invalid page", { status: 400 });
  }

  const supabase = createServerClient();
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data } = await supabase
    .from("seo_news")
    .select("slug, updated_at")
    .not("slug", "is", null)
    .order("updated_at", { ascending: false })
    .range(from, to);

  if (!data || data.length === 0) {
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>',
      { headers: { "Content-Type": "application/xml" } }
    );
  }

  const today = new Date().toISOString().split("T")[0];

  const urls = data
    .flatMap((row) => {
      const lastmod = row.updated_at
        ? new Date(row.updated_at).toISOString().split("T")[0]
        : today;
      return [
        `\n  <url>\n    <loc>${BASE_URL}/en/news/${row.slug}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>\n  </url>`,
        `\n  <url>\n    <loc>${BASE_URL}/es/news/${row.slug}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.6</priority>\n  </url>`,
      ];
    })
    .join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}

export const dynamic = "force-dynamic";
