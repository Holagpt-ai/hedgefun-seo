import { createSeoClient, logRun, jsonResponse, errorResponse } from "../_shared/base.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const AGENTS = [
  "ticker-enrichment-agent",
  "sic-sector-agent",
  "news-agent",
  "news-summary-agent",
  "seo-content-writer-agent",
  "entity-optimizer-agent",
  "ai-seo-agent",
  "meta-optimizer-agent",
  "translation-es-agent",
  "geo-content-optimizer-agent",
  "indexing-agent",
  "serp-analysis-agent",
  "content-gap-analysis-agent",
  "rank-tracker-agent",
  "on-page-auditor-agent",
  "content-refresher-agent",
  "alert-manager-agent",
];

Deno.serve(async (req) => {
  try {
    const seo = createSeoClient();
    const runId = `run_${new Date().toISOString()}`;

    console.log(`Orchestrator firing run: ${runId}`);

    // Fire all agents without awaiting — each runs independently
    for (const agent of AGENTS) {
      fetch(`${SUPABASE_URL}/functions/v1/${agent}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({ run_id: runId }),
      }).catch((err) => {
        console.error(`Failed to fire ${agent}:`, err);
      });
    }

    await logRun(seo, "orchestrator", "success", {
      run_id: runId,
      agents_fired: AGENTS.length,
    });

    console.log(`Orchestrator fired ${AGENTS.length} agents for run: ${runId}`);

    return jsonResponse({
      status: "fired",
      run_id: runId,
      agents_fired: AGENTS.length,
      message: "All agents fired. Check agent_logs for results.",
    });

  } catch (err) {
    console.error("Orchestrator fatal error:", err);
    return errorResponse(err instanceof Error ? err.message : "Unknown error");
  }
});
