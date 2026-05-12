typescriptimport { createSeoClient, createSourceClient, logRun, jsonResponse, errorResponse } from "../_shared/base.ts";

Deno.serve(async (req) => {
  try {
    const seo = createSeoClient();
    const source = createSourceClient();

    // Fetch all tickers we currently have SEO pages for
    const { data: existingTickers, error: existingError } = await seo
      .from("seo_tickers")
      .select("ticker");

    if (existingError) throw new Error(`Fetch existing error: ${existingError.message}`);

    const existingSet = new Set((existingTickers ?? []).map((r) => r.ticker));

    // Fetch all tickers from source Supabase
    const { data: sourceTickers, error: sourceError } = await source
      .from("ticker_search")
      .select("ticker, type, market_cap, name")
      .order("market_cap", { ascending: false, nullsFirst: false })
      .limit(5000);

    if (sourceError) throw new Error(`Fetch source error: ${sourceError.message}`);

    // Identify tickers in source but not in SEO layer
    const gaps = (sourceTickers ?? []).filter((r) => !existingSet.has(r.ticker));

    // Categorize gaps by type
    const stockGaps = gaps.filter((r) => r.type === "stock" || !r.type);
    const etfGaps = gaps.filter((r) => r.type === "etf");
    const ipoGaps = gaps.filter((r) => r.type === "ipo");

    // Top 20 missing by market cap for priority enrichment
    const topMissing = gaps.slice(0, 20).map((r) => ({
      ticker: r.ticker,
      name: r.name,
      type: r.type,
      market_cap: r.market_cap,
    }));

    const gapSummary = {
      total_source_tickers: sourceTickers?.length ?? 0,
      total_seo_tickers: existingTickers?.length ?? 0,
      total_gaps: gaps.length,
      stock_gaps: stockGaps.length,
      etf_gaps: etfGaps.length,
      ipo_gaps: ipoGaps.length,
      top_missing_by_market_cap: topMissing,
      last_analyzed: new Date().toISOString(),
    };

    // Write gap analysis to agent_knowledge for admin Reports tab
    await seo.from("agent_knowledge").upsert({
      agent_name: "content-gap-analysis-agent",
      knowledge_type: "gap_analysis",
      key: `gap_run_${new Date().toISOString().split("T")[0]}`,
      value: gapSummary,
      confidence_score: 1.0,
      observations: gaps.length,
    });

    await logRun(seo, "content-gap-analysis-agent", "success", {
      total_gaps: gaps.length,
      stock_gaps: stockGaps.length,
      etf_gaps: etfGaps.length,
      ipo_gaps: ipoGaps.length,
    });

    return jsonResponse({ status: "success", ...gapSummary });

  } catch (err) {
    console.error("content-gap-analysis-agent fatal error:", err);
    return errorResponse(err instanceof Error ? err.message : "Unknown error");
  }
});
