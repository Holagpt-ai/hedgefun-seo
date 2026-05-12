typescriptimport { createSeoClient, logRun, jsonResponse, errorResponse } from "../_shared/base.ts";

const BATCH_SIZE = 50;
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

Deno.serve(async (req) => {
  try {
    const seo = createSeoClient();

    const { data: tickers, error: fetchError } = await seo
      .from("seo_tickers")
      .select("id, ticker, company_name, description_en, sector, industry, exchange, entity_data")
      .not("enriched_at", "is", null)
      .filter("entity_data->ceo", "is", null)
      .limit(BATCH_SIZE);

    if (fetchError) throw new Error(`Fetch error: ${fetchError.message}`);
    if (!tickers || tickers.length === 0) {
      await logRun(seo, "entity-optimizer-agent", "skipped", { reason: "no tickers pending entity optimization" });
      return jsonResponse({ status: "skipped", processed: 0 });
    }

    let processed = 0;
    let errors = 0;

    for (const ticker of tickers) {
      try {
        const prompt = buildPrompt(ticker);
        const result = await callClaude(prompt);

        if (!result) {
          errors++;
          continue;
        }

        const mergedEntityData = {
          ...(ticker.entity_data ?? {}),
          ceo: result.ceo ?? null,
          founded: result.founded ?? null,
          headquarters: result.headquarters ?? ticker.entity_data?.headquarters ?? null,
          employees: result.employees ?? ticker.entity_data?.employees ?? null,
          website: result.website ?? ticker.entity_data?.website ?? null,
          competitors: result.competitors ?? [],
          related_tickers: result.related_tickers ?? [],
          tags: result.tags ?? [],
        };

        const { error: updateError } = await seo
          .from("seo_tickers")
          .update({
            entity_data: mergedEntityData,
            updated_at: new Date().toISOString(),
          })
          .eq("id", ticker.id);

        if (updateError) {
          errors++;
          console.error(`Update error for ${ticker.ticker}:`, updateError.message);
        } else {
          processed++;
        }

        await delay(500);

      } catch (err) {
        errors++;
        console.error(`Failed entity optimization for ${ticker.ticker}:`, err);
      }
    }

    await logRun(seo, "entity-optimizer-agent", "success", { processed, errors });
    return jsonResponse({ status: "success", processed, errors });

  } catch (err) {
    console.error("entity-optimizer-agent fatal error:", err);
    return errorResponse(err instanceof Error ? err.message : "Unknown error");
  }
});

function buildPrompt(ticker: any): string {
  return `You are a financial data analyst. Extract structured entity data for the following company.

Ticker: ${ticker.ticker}
Company: ${ticker.company_name ?? ticker.ticker}
Sector: ${ticker.sector ?? "Unknown"}
Industry: ${ticker.industry ?? "Unknown"}
Description: ${ticker.description_en ?? "No description available"}

Return ONLY a JSON object with exactly these fields, no preamble, no markdown:
{
  "ceo": "Current CEO full name or null if unknown",
  "founded": "Year founded as string or null if unknown",
  "headquarters": "City, State, Country or null if unknown",
  "employees": null or integer number of employees,
  "website": "https://company.com or null if unknown",
  "competitors": ["TICKER1", "TICKER2", "TICKER3"],
  "related_tickers": ["TICKER1", "TICKER2"],
  "tags": ["tag1", "tag2", "tag3"]
}`;
}

async function callClaude(prompt: string): Promise<any> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY")!;

  const res = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) throw new Error(`Claude API error: ${res.status}`);

  const data = await res.json();
  const text = data.content?.[0]?.text ?? "";

  try {
    return JSON.parse(text);
  } catch {
    console.error("Failed to parse Claude response:", text);
    return null;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
