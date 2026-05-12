import { createSeoClient, logRun, jsonResponse, errorResponse } from "../_shared/base.ts";

const BATCH_SIZE = 50;
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

Deno.serve(async (req) => {
  try {
    const seo = createSeoClient();

    const { data: tickers, error: fetchError } = await seo
      .from("seo_tickers")
      .select("id, ticker, company_name, description_es, meta_title_es, meta_description_es, sector, type")
      .not("meta_title_es", "is", null)
      .is("geo_variants", null)
      .limit(BATCH_SIZE);

    if (fetchError) throw new Error(`Fetch error: ${fetchError.message}`);
    if (!tickers || tickers.length === 0) {
      await logRun(seo, "geo-content-optimizer-agent", "skipped", { reason: "no tickers pending geo optimization" });
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
            geo_variants: {
              mx: result.mx ?? null,
              co: result.co ?? null,
              es: result.es ?? null,
            },
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
        console.error(`Failed geo optimization for ${ticker.ticker}:`, err);
      }
    }

    await logRun(seo, "geo-content-optimizer-agent", "success", { processed, errors });
    return jsonResponse({ status: "success", processed, errors });

  } catch (err) {
    console.error("geo-content-optimizer-agent fatal error:", err);
    return errorResponse(err instanceof Error ? err.message : "Unknown error");
  }
});

function buildPrompt(ticker: any): string {
  return `You are a multilingual financial content strategist specializing in Spanish-speaking markets.

Create geo-specific title and description variants for the following stock for three Spanish-speaking markets: Mexico (MX), Colombia (CO), and Spain (ES).

Each variant should feel locally relevant — use terminology, phrasing, and references natural to that specific market. Do not just copy the same text three times.

Ticker: ${ticker.ticker}
Company: ${ticker.company_name ?? ticker.ticker}
Sector: ${ticker.sector ?? "Unknown"}
Base Spanish Title: ${ticker.meta_title_es ?? ""}
Base Spanish Description: ${ticker.meta_description_es ?? ""}

Rules:
- Keep ticker symbols untranslated
- Keep company names untranslated
- Keep "HedgeFun" untranslated
- Each title must be under 60 characters
- Each description must be under 155 characters
- MX: Use Mexican Spanish financial terminology
- CO: Use Colombian Spanish financial terminology  
- ES: Use Spain Spanish financial terminology (vosotros forms acceptable)

Return ONLY a JSON object with exactly this structure, no preamble, no markdown:
{
  "mx": {
    "title": "Mexico-specific title under 60 chars",
    "description": "Mexico-specific description under 155 chars"
  },
  "co": {
    "title": "Colombia-specific title under 60 chars",
    "description": "Colombia-specific description under 155 chars"
  },
  "es": {
    "title": "Spain-specific title under 60 chars",
    "description": "Spain-specific description under 155 chars"
  }
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
