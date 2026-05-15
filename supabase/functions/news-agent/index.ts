import { createSeoClient, polygonGet, logRun, jsonResponse, errorResponse } from "../_shared/base.ts";
import type { PolygonNewsArticle } from "../_shared/types.ts";

const BATCH_SIZE = 50;

Deno.serve(async (req) => {
  try {
    const seo = createSeoClient();

    const data = await polygonGet(`/v2/reference/news?limit=${BATCH_SIZE}&order=desc&sort=published_utc`);
    const articles: PolygonNewsArticle[] = data.results ?? [];

    if (articles.length === 0) {
      await logRun(seo, "news-agent", "skipped", { reason: "no articles returned from Polygon" });
      return jsonResponse({ status: "skipped", processed: 0 });
    }

    let processed = 0;
    let errors = 0;

    for (const article of articles) {
      try {
        const slug = slugify(article.title);

        const payload = {
          slug,
          title_en: article.title ?? null,
          source: article.publisher?.name ?? null,
          source_url: article.article_url ?? null,
          image_url: article.image_url ?? null,
          ticker: article.tickers?.[0] ?? null,
          published_at: article.published_utc ?? null,
        };

        const { error: upsertError } = await seo
          .from("seo_news")
          .upsert(payload, { onConflict: "slug" });

        if (upsertError) {
          errors++;
          console.error(`Upsert error for slug ${slug}:`, upsertError.message);
        } else {
          processed++;
        }

      } catch (err) {
        errors++;
        console.error(`Failed to process article:`, err);
      }
    }

    await logRun(seo, "news-agent", "success", { processed, errors });
    return jsonResponse({ status: "success", processed, errors });

  } catch (err) {
    console.error("news-agent fatal error:", err);
    return errorResponse(err instanceof Error ? err.message : "Unknown error");
  }
});

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}