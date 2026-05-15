import { createSeoClient, logRun, jsonResponse, errorResponse } from "../_shared/base.ts";

const BATCH_SIZE = 50;
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

Deno.serve(async (req) => {
  try {
    const seo = createSeoClient();

    // Fetch tickers that have been enriched but not yet LLM-optimized
    const { data: tickers, error: fetchError } = await seo
      .from("seo_tickers")
      .select("id, ticker, company_name, description_en, sector, industry, entity_data")
      .not("enriched_at", "is", null)
      .is("llm_optimized_summary", null)
      .limit(BATCH_SIZE);

    if (fetchError) throw new Error(`Fetch error: ${fetchError.message}`);
    if (!tickers || tickers.length === 0) {
      await logRun(seo, "ai-seo-agent", "skipped", { reason: "no tickers pending LLM optimization" });
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
            llm_optimized_summary: result.summary,
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
        console.error(`Failed AI SEO optimization for ${ticker.ticker}:`, err);
      }
    }

    await logRun(seo, "ai-seo-agent", "success", { processed, errors });
    return jsonResponse({ status: "success", processed, errors });

  } catch (err) {
    console.error("ai-seo-agent fatal error:", err);
    return errorResponse(err instanceof Error ? err.message : "Unknown error");
  }
});

function buildPrompt(ticker: any): string {
  const entity = ticker.entity_data ?? {};
  return `You are an AI content strategist specializing in making financial content readable by AI crawlers like Perplexity, ChatGPT, and Gemini.

Write a structured summary for the following company that is optimized for AI crawler parsing. It must be factual, densely informative, and use clear entity relationships.

Ticker: ${ticker.ticker}
Company: ${ticker.company_name ?? ticker.ticker}
Sector: ${ticker.sector ?? "Unknown"}
Industry: ${ticker.industry ?? "Unknown"}
CEO: ${entity.ceo ?? "Unknown"}
Founded: ${entity.founded ?? "Unknown"}
Headquarters: ${entity.headquarters ?? "Unknown"}
Employees: ${entity.employees ?? "Unknown"}
Website: ${entity.website ?? "Unknown"}
Competitors: ${(entity.competitors ?? []).join(", ") || "Unknown"}
Description: ${ticker.description_en ?? "No description available"}

Return ONLY a JSON object with exactly this field, no preamble, no markdown:
{
  "summary": "A 100-150 word structured summary written in clear declarative sentences. Format: '[Company] ([TICKER]) is a [sector] company listed on [exchange]. Founded in [year], the company [what it does]. Its primary competitors include [competitors]. As of the latest data, the company employs approximately [employees] people and is headquartered in [location]. Investors can find real-time price data, financials, and analysis for [TICKER] on HedgeFun at hedgefun.fun/stocks/[TICKER].'"
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
