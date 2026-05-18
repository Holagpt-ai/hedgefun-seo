import { createSeoClient, createSourceClient, polygonGet, logRun, jsonResponse, errorResponse } from "../_shared/base.ts";
import type { PolygonTickerDetail } from "../_shared/types.ts";

const BATCH_SIZE = 500;

Deno.serve(async (req) => {
  try {
    const seo = createSeoClient();
    const source = createSourceClient();

    // Get all tickers already in seo_tickers so we can exclude them
    const { data: existing, error: existingError } = await seo
      .from("seo_tickers")
      .select("ticker");

    if (existingError) throw new Error(`Existing fetch error: ${existingError.message}`);

    const existingSet = new Set((existing ?? []).map((r: any) => r.ticker));

    // Fetch from ticker_search ordered by market cap, skip already enriched
    const { data: allTickers, error: fetchError } = await source
      .from("ticker_search")
      .select("symbol, type, market_cap")
      .order("market_cap", { ascending: false, nullsFirst: false })
      .limit(5000);

    if (fetchError) throw new Error(`Source fetch error: ${fetchError.message}`);
    if (!allTickers || allTickers.length === 0) {
      await logRun(seo, "ticker-enrichment-agent", "skipped", { reason: "no tickers found in source" });
      return jsonResponse({ status: "skipped", processed: 0 });
    }

    // Filter out already-enriched tickers
    const unenriched = allTickers.filter((r: any) => !existingSet.has(r.symbol));

    if (unenriched.length === 0) {
      await logRun(seo, "ticker-enrichment-agent", "skipped", { reason: "all tickers already enriched" });
      return jsonResponse({ status: "skipped", processed: 0, message: "all tickers already enriched" });
    }

    // Take next batch
    const batch = unenriched.slice(0, BATCH_SIZE);

    let processed = 0;
    let errors = 0;

    for (const row of batch) {
      try {
        const data = await polygonGet(`/v3/reference/tickers/${row.symbol}`);
        const detail: PolygonTickerDetail = data.results;

        if (!detail) {
          errors++;
          continue;
        }

        // Derive sector from sic_code first, fall back to sic_description
        const sector = detail.sic_code
          ? sicCodeToSector(detail.sic_code)
          : detail.sic_description
          ? sicDescriptionToSector(detail.sic_description)
          : null;

        const upsertPayload = {
          ticker: row.symbol,
          company_name: detail.name ?? null,
          type: mapType(detail.type ?? row.type),
          exchange: detail.primary_exchange ?? null,
          sic_code: detail.sic_code ?? null,
          sector,
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
          console.error(`Upsert error for ${row.symbol}:`, upsertError.message);
        } else {
          processed++;
        }

        await delay(85);

      } catch (err) {
        errors++;
        console.error(`Failed to enrich ${row.symbol}:`, err);
      }
    }

    await logRun(seo, "ticker-enrichment-agent", "success", {
      processed,
      errors,
      batch_size: batch.length,
      remaining: unenriched.length - batch.length,
    });

    return jsonResponse({ status: "success", processed, errors, remaining: unenriched.length - batch.length });

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

function sicCodeToSector(sicCode: string): string | null {
  const sic = parseInt(sicCode, 10);
  if (isNaN(sic)) return null;
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
  return null;
}

function sicDescriptionToSector(desc: string): string | null {
  if (!desc) return null;
  const d = desc.toUpperCase();
  if (d.includes("PHARMACEUTICAL") || d.includes("MEDICAL") || d.includes("HOSPITAL") ||
      d.includes("HEALTH") || d.includes("SURGICAL") || d.includes("BIOLOGICAL") ||
      d.includes("DIAGNOSTIC") || d.includes("ORTHOPEDIC") || d.includes("ELECTROMEDICAL")) return "Healthcare";
  if (d.includes("SOFTWARE") || d.includes("SEMICONDUCTOR") || d.includes("COMPUTER") ||
      d.includes("ELECTRONIC COMPUTERS") || d.includes("DATA PROCESSING") ||
      d.includes("OPTICAL INSTRUMENTS") || d.includes("MEASURING") ||
      d.includes("ELECTRONIC COMPONENTS")) return "Technology";
  if (d.includes("BANK") || d.includes("INSURANCE") || d.includes("BROKER") ||
      d.includes("INVESTMENT") || d.includes("FINANCE") || d.includes("CREDIT") ||
      d.includes("SECURITY BROKERS") || d.includes("SURETY")) return "Financials";
  if (d.includes("PETROLEUM") || d.includes("OIL") || d.includes("GAS FIELD") ||
      d.includes("CRUDE") || d.includes("DRILLING") || d.includes("NATURAL GAS TRANSMISSION")) return "Energy";
  if (d.includes("RAILROAD") || d.includes("AIRCRAFT") || d.includes("TRUCKING") ||
      d.includes("TRANSPORTATION") || d.includes("COURIER") || d.includes("MACHINERY") ||
      d.includes("ENGINES") || d.includes("REFUSE") || d.includes("GUIDED MISSILES")) return "Industrials";
  if (d.includes("REAL ESTATE") || d.includes("REIT")) return "Real Estate";
  if (d.includes("ELECTRIC SERVICES") || d.includes("WATER SUPPLY") || d.includes("GAS DISTRIBUTION")) return "Utilities";
  if (d.includes("TELEPHONE") || d.includes("CABLE") || d.includes("RADIOTELEPHONE") ||
      d.includes("BROADCASTING")) return "Communication Services";
  if (d.includes("RETAIL") || d.includes("HOTEL") || d.includes("MOTEL") ||
      d.includes("AMUSEMENT") || d.includes("EATING")) return "Consumer Discretionary";
  if (d.includes("TOBACCO") || d.includes("FOOD") || d.includes("GROCERY") ||
      d.includes("BEVERAGE") || d.includes("CIGARETTE") || d.includes("SOFT DRINKS")) return "Consumer Staples";
  if (d.includes("MINING") || d.includes("METALS") || d.includes("CHEMICALS") ||
      d.includes("GOLD") || d.includes("SILVER") || d.includes("WIRE") || d.includes("SOAP")) return "Materials";
  return null;
}