import { createSeoClient, logRun, jsonResponse, errorResponse } from "../_shared/base.ts";

const BATCH_SIZE = 1000;

Deno.serve(async () => {
  try {
    const seo = createSeoClient();

    const { data: tickers, error: fetchError } = await seo
      .from("seo_tickers")
      .select("id, sic_code")
      .not("sic_code", "is", null)
      .order("updated_at", { ascending: true, nullsFirst: true })
      .limit(BATCH_SIZE);

    if (fetchError) throw new Error(`Ticker fetch error: ${fetchError.message}`);

    if (!tickers || tickers.length === 0) {
      await logRun(seo, "sic-sector-agent", "skipped", { reason: "no rows with sic_code found" });
      return jsonResponse({ status: "skipped", processed: 0, errors: 0 });
    }

    let processed = 0;
    let errors = 0;

    for (const ticker of tickers as Array<{ id: string; sic_code: string }>) {
      try {
        const sector = sicToSector(ticker.sic_code);
        const { error: updateError } = await seo
          .from("seo_tickers")
          .update({ sector, updated_at: new Date().toISOString() })
          .eq("id", ticker.id);

        if (updateError) {
          errors++;
          console.error(`Update error for ticker id ${ticker.id}:`, updateError.message);
          continue;
        }

        processed++;
      } catch (err) {
        errors++;
        console.error(`Failed to map sector for ticker id ${ticker.id}:`, err);
      }
    }

    await logRun(seo, "sic-sector-agent", "success", {
      processed,
      errors,
      batch_size: tickers.length,
    });

    return jsonResponse({ status: "success", processed, errors });
  } catch (err) {
    console.error("sic-sector-agent fatal error:", err);
    return errorResponse(err instanceof Error ? err.message : "Unknown error");
  }
});

function sicToSector(sicCode: string): string {
  const sic = Number.parseInt(sicCode, 10);
  if (Number.isNaN(sic)) return "Other";
  if (sic >= 100 && sic <= 999) return "Consumer Staples";
  if (sic >= 1000 && sic <= 1499) return "Energy";
  if (sic >= 1500 && sic <= 1799) return "Industrials";
  if (sic >= 2000 && sic <= 2199) return "Consumer Staples";
  if (sic >= 2200 && sic <= 2399) return "Consumer Discretionary";
  if (sic >= 2400 && sic <= 2799) return "Materials";
  if (sic >= 2800 && sic <= 2999) return "Healthcare";
  if (sic >= 3000 && sic <= 3499) return "Materials";
  if (sic >= 3500 && sic <= 3699) return "Technology";
  if (sic >= 3700 && sic <= 3799) return "Industrials";
  if (sic >= 3800 && sic <= 3899) return "Healthcare";
  if (sic >= 3900 && sic <= 3999) return "Consumer Discretionary";
  if (sic >= 4000 && sic <= 4799) return "Industrials";
  if (sic >= 4800 && sic <= 4899) return "Communication Services";
  if (sic >= 4900 && sic <= 4999) return "Utilities";
  if (sic >= 5000 && sic <= 5999) return "Consumer Discretionary";
  if (sic >= 6000 && sic <= 6499) return "Financials";
  if (sic >= 6500 && sic <= 6599) return "Real Estate";
  if (sic >= 6600 && sic <= 6799) return "Financials";
  if (sic >= 7000 && sic <= 7299) return "Consumer Discretionary";
  if (sic >= 7300 && sic <= 7399) return "Technology";
  if (sic >= 7400 && sic <= 7999) return "Consumer Discretionary";
  if (sic >= 8000 && sic <= 8099) return "Healthcare";
  if (sic >= 8100 && sic <= 8999) return "Industrials";
  if (sic >= 9000 && sic <= 9999) return "Industrials";
  return "Other";
}
