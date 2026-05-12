import { createSeoClient, polygonGet, logRun, jsonResponse, errorResponse } from "../_shared/base.ts";
import type { PolygonTickerDetail } from "../_shared/types.ts";

const BATCH_SIZE = 50;
const STALE_DAYS = 30;

Deno.serve(async (req) => {
  try {
    const seo = createSeoClient();

    // Calculate stale threshold date
    const staleDate = new Date();
    staleDate.setDate(staleDate.getDate() - STALE_DAYS);
    const staleDateISO = staleDate.toISOString();

    // Fetch tickers that have not been refreshed in 30+ days
    const { data: tickers, error: fetchError } = await seo
      .from("seo_tickers")
      .select("id, ticker, type, market_cap")
      .not("enriched_at", "is", null)
      .or(`refreshed_at.is.null,refreshed_at.lt.${staleDateISO}`)
      .order("market_cap", { ascending: false, nullsFirst: false })
      .limit(BATCH_SIZE);

    if (fetchError) throw new Error(`Fetch error: ${fetchError.message}`);
    if (!tickers || tickers.length === 0) {
      await logRun(seo, "content-refresher-agent", "skipped", { reason: "no stale tickers found" });
      return jsonResponse({ status: "skipped", processed: 0 });
    }

    let processed = 0;
    let errors = 0;

    for (const row of tickers) {
      try {
        const data = await polygonGet(`/v3/reference/tickers/${row.ticker}`);
        const detail: PolygonTickerDetail = data.results;

        if (!detail) {
          errors++;
          continue;
        }

        const { error: updateError } = await seo
          .from("seo_tickers")
          .update({
            company_name: detail.name ?? null,
            market_cap: detail.market_cap ?? row.market_cap ?? null,
            description_en: detail.description ?? null,
            exchange: detail.primary_exchange ?? null,
            // Reset downstream fields so agents re-process with fresh data
            meta_title_en: null,
            meta_title_es: null,
            meta_description_en: null,
            meta_description_es: null,
            description_es: null,
            llm_optimized_summary: null,
            geo_variants: null,
            indexed_at: null,
            audited_at: null,
            enriched_at: new Date().toISOString(),
            refreshed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id);

        if (updateError) {
          errors++;
          console.error(`Update error for ${row.ticker}:`, updateError.message);
        } else {
          processed++;
        }

        await delay(85);

      } catch (err) {
        errors++;
        console.error(`Failed to refresh ${row.ticker}:`, err);
      }
    }

    await logRun(seo, "content-refresher-agent", "success", { processed, errors });
    return jsonResponse({ status: "success", processed, errors });

  } catch (err) {
    console.error("content-refresher-agent fatal error:", err);
    return errorResponse(err instanceof Error ? err.message : "Unknown error");
  }
});

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
