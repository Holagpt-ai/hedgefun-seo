typescriptimport { createSeoClient, logRun, jsonResponse, errorResponse } from "../_shared/base.ts";

const BATCH_SIZE = 50;
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

Deno.serve(async (req) => {
  try {
    const seo = createSeoClient();

    const { data: tickers, error: fetchError } = await seo
      .from("seo_tickers")
      .select("id, ticker, company_name, description_en, meta_title_en, meta_description_en, sector, type")
      .not("meta_title_en", "is", null)
      .is("meta_title_es", null)
      .limit(BATCH_SIZE);

    if (fetchError) throw new Error(`Fetch error: ${fetchError.message}`);
    if (!tickers || tickers.length === 0) {
      await logRun(seo, "translation-es-agent", "skipped", { reason: "no tickers pending Spanish translation" });
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
            description_es: result.description_es,
            meta_title_es: result.meta_title_es,
            meta_description_es: result.meta_description_es,
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
        console.error(`Failed translation for ${ticker.ticker}:`, err);
      }
    }

    await logRun(seo, "translation-es-agent", "success", { processed, errors });
    return jsonResponse({ status: "success", processed, errors });

  } catch (err) {
    console.error("translation-es-agent fatal error:", err);
    return errorResponse(err instanceof Error ? err.message : "Unknown error");
  }
});

function buildPrompt(ticker: any): string {
  return `You are a professional financial translator specializing in Spanish for Latin American and Spanish markets.

Translate the following financial content from English to Spanish. The translation must be natural, professional, and appropriate for investors in Mexico, Colombia, and Spain.

Ticker: ${ticker.ticker}
Company: ${ticker.company_name ?? ticker.ticker}
Sector: ${ticker.sector ?? "Unknown"}

English Description: ${ticker.description_en ?? "No description available"}
English Meta Title: ${ticker.meta_title_en ?? ""}
English Meta Description: ${ticker.meta_description_en ?? ""}

Rules:
- Keep ticker symbols in uppercase and untranslated
- Keep company names untranslated
- Keep "HedgeFun" untranslated
- Meta title must be under 60 characters
- Meta description must be under 155 characters
- Use natural financial Spanish, not literal word-for-word translation

Return ONLY a JSON object with exactly these fields, no preamble, no markdown:
{
  "description_es": "Spanish translation of the full description",
  "meta_title_es": "Spanish meta title under 60 characters",
  "meta_description_es": "Spanish meta description under 155 characters"
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

