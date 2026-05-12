typescriptimport { createSeoClient, createSourceClient, polygonGet, logRun, jsonResponse, errorResponse } from "../_shared/base.ts";
import type { PolygonTickerDetail } from "../_shared/types.ts";

const BATCH_SIZE = 200;

Deno.serve(async (req) => {
  try {
    const seo = createSeoClient();
    const source = createSourceClient();

    // Fetch unenriched tickers from source Supabase ordered by market cap desc, stocks first
    const { data: tickers, error: fetchError } = await source
      .from("ticker_search")
      .select("ticker, type, market_cap")
      .is("enriched_at", null)
      .order("type", { ascending: true }) // stocks before etf/ipo alphabetically — override below
      .order("market_cap", { ascending: false, nullsFirst: false })
      .limit(BATCH_SIZE);

    if (fetchError) throw new Error(`Source fetch error: ${fetchError.message}`);
    if (!tickers || tickers.length === 0) {
      await logRun(seo, "ticker-enrichment-agent", "skipped", { reason: "no unenriched tickers" });
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

        const upsertPayload = {
          ticker: row.ticker,
          company_name: detail.name ?? null,
          type: mapType(detail.type ?? row.type),
          exchange: detail.primary_exchange ?? null,
          sector: detail.sic_description ?? null,
          industry: detail.sic_description ?? null,
          market_cap: detail.market_cap ?? row.market_cap ?? null,
          description_en: detail.description ?? null,
          entity_data: {
            ceo: null,
            founded: null,
            headquarters: detail.address
              ? [detail.address.city, detail.address.state, detail.address.country]
                  .filter(Boolean)
                  .join(", ")
              : null,
            employees: detail.total_employees ?? null,
            website: detail.homepage_url ?? null,
            competitors: [],
            related_tickers: [],
            tags: [],
          },
          enriched_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const { error: upsertError } = await seo
          .from("seo_tickers")
          .upsert(upsertPayload, { onConflict: "ticker" });

        if (upsertError) {
          errors++;
          console.error(`Upsert error for ${row.ticker}:`, upsertError.message);
        } else {
          processed++;
        }

        // Respect Polygon rate limit — 12 requests/second on Starter plan
        await delay(85);

      } catch (err) {
        errors++;
        console.error(`Failed to enrich ${row.ticker}:`, err);
      }
    }

    await logRun(seo, "ticker-enrichment-agent", "success", {
      processed,
      errors,
      batch_size: tickers.length,
    });

    return jsonResponse({ status: "success", processed, errors });

  } catch (err) {
    console.error("ticker-enrichment-agent fatal error:", err);
    return errorResponse(err instanceof Error ? err.message : "Unknown error");
  }
});

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mapType(raw: string): "stock" | "etf" | "ipo" {
  if (!raw) return "stock";
  const t = raw.toLowerCase();
  if (t === "etf" || t === "etp") return "etf";
  if (t === "ipo") return "ipo";
  return "stock";
}
