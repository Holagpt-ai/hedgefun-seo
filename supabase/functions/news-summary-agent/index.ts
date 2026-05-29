import { createSeoClient, logRun, jsonResponse, errorResponse } from "../_shared/base.ts";

const BATCH_SIZE = 20;
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

Deno.serve(async (_req) => {
  try {
    const seo = createSeoClient();

    const { data: articles, error: fetchError } = await seo
      .from("seo_news")
      .select("id, title_en, source")
      .is("summary_en", null)
      .not("title_en", "is", null)
      .limit(BATCH_SIZE);

    if (fetchError) throw new Error(`Fetch error: ${fetchError.message}`);
    if (!articles || articles.length === 0) {
      await logRun(seo, "news-summary-agent", "skipped", { reason: "no articles pending summary" });
      return jsonResponse({ status: "skipped", processed: 0 });
    }

    let processed = 0;
    let errors = 0;

    for (const article of articles) {
      try {
        const result = await callClaude(article.title_en, article.source);

        if (!result) {
          errors++;
          continue;
        }

        const { error: updateError } = await seo
          .from("seo_news")
          .update({
            summary_en: result.summary_en,
            summary_es: result.summary_es,
          })
          .eq("id", article.id);

        if (updateError) {
          errors++;
          console.error(`Update error for article ${article.id}:`, updateError.message);
        } else {
          processed++;
        }

        await delay(200);

      } catch (err) {
        errors++;
        console.error(`Failed to summarize article ${article.id}:`, err);
      }
    }

    await logRun(seo, "news-summary-agent", "success", { processed, errors });
    return jsonResponse({ status: "success", processed, errors });

  } catch (err) {
    console.error("news-summary-agent fatal error:", err);
    return errorResponse(err instanceof Error ? err.message : "Unknown error");
  }
});

function buildPrompt(title: string, source: string | null): string {
  return `You are a financial news editor. Write a brief 2-3 sentence summary of a news article based on its headline, then translate that summary into Spanish.

Headline: ${title}
Source: ${source ?? "Unknown"}

Return ONLY a JSON object with exactly these two fields, no preamble, no markdown:
{
  "summary_en": "2-3 sentence summary in English, 40-80 words, written for investors. Neutral, factual tone.",
  "summary_es": "Exact Spanish translation of summary_en."
}`;
}

async function callClaude(title: string, source: string | null): Promise<{ summary_en: string; summary_es: string } | null> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const res = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      messages: [{ role: "user", content: buildPrompt(title, source) }],
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
