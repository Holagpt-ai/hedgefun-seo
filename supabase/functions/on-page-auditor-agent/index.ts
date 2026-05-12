typescriptimport { createSeoClient, logRun, jsonResponse, errorResponse } from "../_shared/base.ts";

const BATCH_SIZE = 50;
const BASE_URL = "https://seo.hedgefun.fun";

Deno.serve(async (req) => {
  try {
    const seo = createSeoClient();

    // Fetch indexed tickers that have never been audited
    const { data: tickers, error: fetchError } = await seo
      .from("seo_tickers")
      .select("id, ticker, type, meta_title_en, meta_description_en, description_en, entity_data, llm_optimized_summary")
      .not("indexed_at", "is", null)
      .is("audited_at", null)
      .limit(BATCH_SIZE);

    if (fetchError) throw new Error(`Fetch error: ${fetchError.message}`);
    if (!tickers || tickers.length === 0) {
      await logRun(seo, "on-page-auditor-agent", "skipped", { reason: "no tickers pending audit" });
      return jsonResponse({ status: "skipped", processed: 0 });
    }

    let processed = 0;
    let errors = 0;
    const issues: Record<string, string[]> = {};

    for (const ticker of tickers) {
      try {
        const tickerIssues: string[] = [];

        // Check meta title
        if (!ticker.meta_title_en) {
          tickerIssues.push("missing meta_title_en");
        } else if (ticker.meta_title_en.length > 60) {
          tickerIssues.push(`meta_title_en too long: ${ticker.meta_title_en.length} chars`);
        }

        // Check meta description
        if (!ticker.meta_description_en) {
          tickerIssues.push("missing meta_description_en");
        } else if (ticker.meta_description_en.length > 155) {
          tickerIssues.push(`meta_description_en too long: ${ticker.meta_description_en.length} chars`);
        }

        // Check description length — thin content threshold
        if (!ticker.description_en) {
          tickerIssues.push("missing description_en");
        } else if (ticker.description_en.length < 100) {
          tickerIssues.push(`thin content: description_en only ${ticker.description_en.length} chars`);
        }

        // Check entity data
        if (!ticker.entity_data) {
          tickerIssues.push("missing entity_data");
        }

        // Check LLM summary
        if (!ticker.llm_optimized_summary) {
          tickerIssues.push("missing llm_optimized_summary");
        }

        if (tickerIssues.length > 0) {
          issues[ticker.ticker] = tickerIssues;
        }

        // Mark as audited regardless of issues found
        const { error: updateError } = await seo
          .from("seo_tickers")
          .update({ audited_at: new Date().toISOString() })
          .eq("id", ticker.id);

        if (updateError) {
          errors++;
          console.error(`Update error for ${ticker.ticker}:`, updateError.message);
        } else {
          processed++;
        }

      } catch (err) {
        errors++;
        console.error(`Audit failed for ${ticker.ticker}:`, err);
      }
    }

    // Write audit issues to agent_knowledge table for admin dashboard
    if (Object.keys(issues).length > 0) {
      await seo.from("agent_knowledge").upsert({
        agent_name: "on-page-auditor-agent",
        knowledge_type: "audit_issues",
        key: `audit_run_${new Date().toISOString()}`,
        value: { issues },
        confidence_score: 1.0,
        observations: processed,
      });
    }

    await logRun(seo, "on-page-auditor-agent", "success", {
      processed,
      errors,
      issues_found: Object.keys(issues).length,
    });

    return jsonResponse({ status: "success", processed, errors, issues_found: Object.keys(issues).length });

  } catch (err) {
    console.error("on-page-auditor-agent fatal error:", err);
    return errorResponse(err instanceof Error ? err.message : "Unknown error");
  }
});
