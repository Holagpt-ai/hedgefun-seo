import { createSeoClient, logRun, jsonResponse, errorResponse } from "../_shared/base.ts";

const BATCH_SIZE = 50;

Deno.serve(async (req) => {
  try {
    const seo = createSeoClient();

    // Fetch indexed tickers with no SERP data yet
    const { data: tickers, error: fetchError } = await seo
      .from("seo_tickers")
      .select("id, ticker, company_name, type, sector, serp_data, market_cap")
      .not("indexed_at", "is", null)
      .is("serp_data", null)
      .order("market_cap", { ascending: false, nullsFirst: false })
      .limit(BATCH_SIZE);

    if (fetchError) throw new Error(`Fetch error: ${fetchError.message}`);
    if (!tickers || tickers.length === 0) {
      await logRun(seo, "serp-analysis-agent", "skipped", { reason: "no tickers pending SERP analysis" });
      return jsonResponse({ status: "skipped", processed: 0 });
    }

    let processed = 0;
    let errors = 0;

    for (const ticker of tickers) {
      try {
        const keywords = buildKeywords(ticker);
        const competitorUrls = buildCompetitorUrls(ticker.ticker);

        // Build SERP data record
        // Google Search API integration point — add GOOGLE_SEARCH_API_KEY
        // and GOOGLE_SEARCH_ENGINE_ID secrets to enable live SERP data
        const serpData = {
          top_keywords: keywords,
          avg_position: null, // populated once GSC API is connected
          competitor_urls: competitorUrls,
          last_checked: new Date().toISOString(),
        };

        const { error: updateError } = await seo
          .from("seo_tickers")
          .update({
            serp_data: serpData,
            updated_at: new Date().toISOString(),
          })
          .eq("id", ticker.id);

        if (updateError) {
          errors++;
          console.error(`Update error for ${ticker.ticker}:`, updateError.message);
        } else {
          processed++;
        }

        await delay(100);

      } catch (err) {
        errors++;
        console.error(`SERP analysis failed for ${ticker.ticker}:`, err);
      }
    }

    // Store SERP summary in agent_knowledge
    await seo.from("agent_knowledge").upsert({
      agent_name: "serp-analysis-agent",
      knowledge_type: "serp_summary",
      key: `serp_run_${new Date().toISOString().split("T")[0]}`,
      value: { processed, errors, batch_size: tickers.length },
      confidence_score: 0.7,
      observations: processed,
    });

    await logRun(seo, "serp-analysis-agent", "success", { processed, errors });
    return jsonResponse({ status: "success", processed, errors });

  } catch (err) {
    console.error("serp-analysis-agent fatal error:", err);
    return errorResponse(err instanceof Error ? err.message : "Unknown error");
  }
});

function buildKeywords(ticker: any): string[] {
  const name = ticker.company_name ?? ticker.ticker;
  const base = [
    `${ticker.ticker} stock`,
    `${ticker.ticker} stock price`,
    `${ticker.ticker} stock analysis`,
    `${name} stock`,
    `${name} share price`,
    `${ticker.ticker} forecast`,
    `${ticker.ticker} earnings`,
  ];

  if (ticker.type === "etf") {
    return [
      `${ticker.ticker} ETF`,
      `${ticker.ticker} ETF price`,
      `${ticker.ticker} ETF analysis`,
      `${name} ETF`,
      `${ticker.ticker} holdings`,
    ];
  }

  return base;
}

function buildCompetitorUrls(ticker: string): string[] {
  return [
    `https://stockanalysis.com/stocks/${ticker.toLowerCase()}/`,
    `https://finance.yahoo.com/quote/${ticker}/`,
    `https://www.macrotrends.net/stocks/charts/${ticker}/`,
    `https://simplywall.st/stocks/us/tech/${ticker}/`,
    `https://www.wisesheets.io/${ticker.toLowerCase()}`,
  ];
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
