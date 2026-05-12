import { createSeoClient, logRun, jsonResponse, errorResponse } from "../_shared/base.ts";

const BATCH_SIZE = 50;
const BASE_URL = "https://seo.hedgefun.fun";

Deno.serve(async (req) => {
  try {
    const seo = createSeoClient();

    // Fetch indexed tickers ordered by market cap for priority tracking
    const { data: tickers, error: fetchError } = await seo
      .from("seo_tickers")
      .select("id, ticker, type, company_name, market_cap, serp_data")
      .not("indexed_at", "is", null)
      .order("market_cap", { ascending: false, nullsFirst: false })
      .limit(BATCH_SIZE);

    if (fetchError) throw new Error(`Fetch error: ${fetchError.message}`);
    if (!tickers || tickers.length === 0) {
      await logRun(seo, "rank-tracker-agent", "skipped", { reason: "no indexed tickers to track" });
      return jsonResponse({ status: "skipped", processed: 0 });
    }

    let processed = 0;
    let errors = 0;
    const rankingData: Record<string, unknown>[] = [];

    for (const ticker of tickers) {
      try {
        // Build target keywords for this ticker
        const keywords = buildKeywords(ticker);

        // Check Google Search Console API for position data
        const positionData = await fetchSearchConsoleData(ticker.ticker);

        const serpData = {
          top_keywords: keywords,
          avg_position: positionData?.avg_position ?? null,
          competitor_urls: buildCompetitorUrls(ticker.ticker),
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
          rankingData.push({
            ticker: ticker.ticker,
            keywords,
            avg_position: positionData?.avg_position ?? null,
          });
        }

        await delay(200);

      } catch (err) {
        errors++;
        console.error(`Rank tracking failed for ${ticker.ticker}:`, err);
      }
    }

    // Store ranking summary in agent_knowledge for admin Reports tab
    if (rankingData.length > 0) {
      await seo.from("agent_knowledge").upsert({
        agent_name: "rank-tracker-agent",
        knowledge_type: "ranking_summary",
        key: `rank_run_${new Date().toISOString().split("T")[0]}`,
        value: { rankings: rankingData, total: rankingData.length },
        confidence_score: 0.8,
        observations: processed,
      });
    }

    await logRun(seo, "rank-tracker-agent", "success", { processed, errors });
    return jsonResponse({ status: "success", processed, errors });

  } catch (err) {
    console.error("rank-tracker-agent fatal error:", err);
    return errorResponse(err instanceof Error ? err.message : "Unknown error");
  }
});

function buildKeywords(ticker: any): string[] {
  const name = ticker.company_name ?? ticker.ticker;
  return [
    `${ticker.ticker} stock`,
    `${ticker.ticker} stock price`,
    `${name} stock`,
    `${name} stock analysis`,
    `${ticker.ticker} analysis`,
    `${ticker.ticker} price`,
  ];
}

function buildCompetitorUrls(ticker: string): string[] {
  return [
    `https://stockanalysis.com/stocks/${ticker.toLowerCase()}/`,
    `https://finance.yahoo.com/quote/${ticker}/`,
    `https://www.macrotrends.net/stocks/charts/${ticker}/`,
  ];
}

async function fetchSearchConsoleData(ticker: string): Promise<{ avg_position: number } | null> {
  // Google Search Console API integration
  // Returns null until GSC API credentials are configured
  // To enable: add GOOGLE_SERVICE_ACCOUNT_JSON secret to Supabase Edge Functions
  const serviceAccountJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
  if (!serviceAccountJson) return null;

  try {
    // GSC API call would go here once credentials are available
    // For now returns null — agent still tracks keywords and competitor URLs
    return null;
  } catch {
    return null;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
