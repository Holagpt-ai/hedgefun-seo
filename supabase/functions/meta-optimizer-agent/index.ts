import { createSeoClient, logRun, jsonResponse, errorResponse } from "../_shared/base.ts";

const BATCH_SIZE = 50;
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

Deno.serve(async (req) => {
  try {
    const seo = createSeoClient();

    const { data: tickers, error: fetchError } = await seo
      .from("seo_tickers")
      .select("id, ticker, company_name, description_en, sector, industry, exchange, type")
      .not("description_en", "is", null)
      .is("meta_title_en", null)
      .limit(BATCH_SIZE);

    if (fetchError) throw new Error(`Fetch error: ${fetchError.message}`);
    if (!tickers || tickers.length === 0) {
      await logRun(seo, "meta-optimizer-agent", "skipped", { reason: "no tickers pending meta optimization" });
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

        const { error: updateError } = await seo
          .from("seo_tickers")
          .update({
            meta_title_en: result.meta_title_en,
            meta_description_en: result.meta_description_en,
            updated_at: new Date().toISOString(),
          })
          .eq("id", ticker.id);

        if (updateError) {
          errors++;
          console.error(`Update error for ${ticker.ticker}:`, updateError.message);
        } else {
          processed++;
        }

        await delay(300);

      } catch (err) {
        errors++;
        console.error(`Failed meta optimization for ${ticker.ticker}:`, err);
      }
    }

    await logRun(seo, "meta-optimizer-agent", "success", { processed, errors });
    return jsonResponse({ status: "success", processed, errors });

  } catch (err) {
    console.error("meta-optimizer-agent fatal error:", err);
    return errorResponse(err instanceof Error ? err.message : "Unknown error");
  }
});

function buildPrompt(ticker: any): string {
  const typeLabel = ticker.type === "etf" ? "ETF" : "Stock";
  return `You are an expert SEO strategist for a financial data platform.

Generate optimized meta title and description for the following ${typeLabel}.

Ticker: ${ticker.ticker}
Company: ${ticker.company_name ?? ticker.ticker}
Sector: ${ticker.sector ?? "Unknown"}
Exchange: ${ticker.exchange ?? "Unknown"}
Type: ${typeLabel}
Description: ${ticker.description_en ?? "No description available"}

Rules:
- Meta title must be under 60 characters
- Meta description must be under 155 characters
- Include the ticker symbol in both
- Include HedgeFun in the title
- Use action-oriented language in the description
- Do not use quotes inside the strings

Return ONLY a JSON object with exactly these fields, no preamble, no markdown:
{
  "meta_title_en": "Company Name (TICKER) ${typeLabel} Price & Analysis | HedgeFun",
  "meta_description_en": "Track TICKER ${typeLabel} price, financials, and analysis on HedgeFun."
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
      model: "claude-haiku-4-5",
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) throw new Error(`Claude API error: ${res.status}`);

  const data = await res.json();
  const text = data.content?.[0]?.text ?? "";

  try {
    const clean = text.replace(/```json\n?|```/g, "").trim();
    return JSON.parse(clean);
  } catch {
    console.error("Failed to parse Claude response:", text);
    return null;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}