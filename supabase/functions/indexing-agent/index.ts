import { createSeoClient, logRun, jsonResponse, errorResponse } from "../_shared/base.ts";

const BATCH_SIZE = 100;
const BASE_URL = "https://seo.hedgefun.fun";
const INDEXNOW_KEY = Deno.env.get("INDEXNOW_KEY") ?? "";
const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";

Deno.serve(async (req) => {
  try {
    const seo = createSeoClient();

    // Fetch fully processed tickers not yet submitted to IndexNow
    const { data: tickers, error: fetchError } = await seo
      .from("seo_tickers")
      .select("id, ticker, type")
      .not("enriched_at", "is", null)
      .not("meta_title_en", "is", null)
      .is("indexed_at", null)
      .limit(BATCH_SIZE);

    if (fetchError) throw new Error(`Fetch error: ${fetchError.message}`);
    if (!tickers || tickers.length === 0) {
      await logRun(seo, "indexing-agent", "success", { reason: "no new URLs to submit", processed: 0 });
      return jsonResponse({ status: "success", processed: 0 });
    }

    // Build URL list
    const urls = tickers.map((row) => {
      if (row.type === "etf") return `${BASE_URL}/en/etf/${row.ticker}`;
      if (row.type === "ipo") return `${BASE_URL}/en/ipos/${row.ticker}`;
      return `${BASE_URL}/en/stocks/${row.ticker}`;
    });

    // Submit to IndexNow
    const indexNowRes = await fetch(INDEXNOW_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        host: "seo.hedgefun.fun",
        key: INDEXNOW_KEY,
        keyLocation: `${BASE_URL}/${INDEXNOW_KEY}.txt`,
        urlList: urls,
      }),
    });

    if (!indexNowRes.ok) {
      const body = await indexNowRes.text();
      throw new Error(`IndexNow error: ${indexNowRes.status} — ${body}`);
    }

    // Mark all submitted tickers as indexed
    const ids = tickers.map((r) => r.id);
    const { error: updateError } = await seo
      .from("seo_tickers")
      .update({ indexed_at: new Date().toISOString() })
      .in("id", ids);

    if (updateError) throw new Error(`Mark indexed error: ${updateError.message}`);

    await logRun(seo, "indexing-agent", "success", {
      processed: urls.length,
      urls_submitted: urls,
    });

    return jsonResponse({ status: "success", processed: urls.length });

  } catch (err) {
    console.error("indexing-agent fatal error:", err);
    return errorResponse(err instanceof Error ? err.message : "Unknown error");
  }
});

