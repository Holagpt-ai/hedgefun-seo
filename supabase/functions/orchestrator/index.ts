import { createSeoClient, logRun, jsonResponse, errorResponse } from "../_shared/base.ts";
import type { AgentResult } from "../_shared/types.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  try {
    const seo = createSeoClient();
    const runId = `run_${new Date().toISOString()}`;
    const results: AgentResult[] = [];

    console.log(`Orchestrator starting run: ${runId}`);

    // ── PHASE 1: DATA ACQUISITION ──────────────────────────────────────────
    results.push(await invokeAgent("ticker-enrichment-agent"));
    results.push(await invokeAgent("news-agent"));

    // ── PHASE 2: CONTENT GENERATION ───────────────────────────────────────
    results.push(await invokeAgent("seo-content-writer-agent"));
    results.push(await invokeAgent("entity-optimizer-agent"));
    results.push(await invokeAgent("ai-seo-agent"));

    // ── PHASE 3: OPTIMIZATION ─────────────────────────────────────────────
    results.push(await invokeAgent("meta-optimizer-agent"));
    results.push(await invokeAgent("translation-es-agent"));
    results.push(await invokeAgent("geo-content-optimizer-agent"));

    // ── PHASE 4: INDEXING ─────────────────────────────────────────────────
    results.push(await invokeAgent("indexing-agent"));

    // ── PHASE 5: ANALYSIS ─────────────────────────────────────────────────
    results.push(await invokeAgent("serp-analysis-agent"));
    results.push(await invokeAgent("content-gap-analysis-agent"));
    results.push(await invokeAgent("rank-tracker-agent"));

    // ── PHASE 6: QUALITY & MAINTENANCE ───────────────────────────────────
    results.push(await invokeAgent("on-page-auditor-agent"));
    results.push(await invokeAgent("content-refresher-agent"));

    // ── PHASE 7: ALERTS (always runs last) ────────────────────────────────
    results.push(await invokeAgent("alert-manager-agent"));

    // Summarize run
    const successCount = results.filter((r) => r.status === "success").length;
    const errorCount = results.filter((r) => r.status === "error").length;
    const skippedCount = results.filter((r) => r.status === "skipped").length;

    await logRun(seo, "orchestrator", "success", {
      run_id: runId,
      total_agents: results.length,
      success: successCount,
      errors: errorCount,
      skipped: skippedCount,
      results,
    });

    console.log(`Orchestrator run complete: ${successCount} success, ${errorCount} errors, ${skippedCount} skipped`);

    return jsonResponse({
      status: "success",
      run_id: runId,
      total_agents: results.length,
      success: successCount,
      errors: errorCount,
      skipped: skippedCount,
      results,
    });

  } catch (err) {
    console.error("Orchestrator fatal error:", err);
    return errorResponse(err instanceof Error ? err.message : "Unknown error");
  }
});

async function invokeAgent(agentName: string): Promise<AgentResult> {
  console.log(`Invoking agent: ${agentName}`);

  try {
    const res = await fetch(
      `${SUPABASE_URL}/functions/v1/${agentName}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({}),
      }
    );

    if (!res.ok) {
      const body = await res.text();
      console.error(`Agent ${agentName} HTTP error: ${res.status} — ${body}`);
      return {
        agent: agentName,
        status: "error",
        processed: 0,
        errors: 1,
        message: `HTTP ${res.status}: ${body}`,
      };
    }

    const data = await res.json();
    console.log(`Agent ${agentName} complete:`, data);

    return {
      agent: agentName,
      status: data.status ?? "success",
      processed: data.processed ?? 0,
      errors: data.errors ?? 0,
      message: data.reason ?? `${data.processed ?? 0} records processed`,
    };

  } catch (err) {
    console.error(`Agent ${agentName} invocation error:`, err);
    return {
      agent: agentName,
      status: "error",
      processed: 0,
      errors: 1,
      message: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
