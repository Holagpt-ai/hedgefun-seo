import { createSeoClient, logRun, jsonResponse, errorResponse } from "../_shared/base.ts";

Deno.serve(async (req) => {
  try {
    const seo = createSeoClient();

    // Fetch all agent logs from the last 24 hours
    const since = new Date();
    since.setHours(since.getHours() - 24);

    const { data: logs, error: fetchError } = await seo
      .from("agent_logs")
      .select("agent_name, status, metadata, run_at")
      .gte("run_at", since.toISOString())
      .order("run_at", { ascending: false });

    if (fetchError) throw new Error(`Fetch error: ${fetchError.message}`);

    const alerts: Alert[] = [];

    if (!logs || logs.length === 0) {
      alerts.push({
        severity: "warning",
        agent: "alert-manager-agent",
        message: "No agent logs found in the last 24 hours. Pipeline may not be running.",
        timestamp: new Date().toISOString(),
      });
    } else {
      // Check each agent log for issues
      for (const log of logs) {
        // Flag error status
        if (log.status === "error") {
          alerts.push({
            severity: "error",
            agent: log.agent_name,
            message: `Agent ${log.agent_name} reported error status at ${log.run_at}`,
            details: log.summary,
            timestamp: log.run_at,
          });
        }

        // Flag zero processed with no skip reason
        const summary = log.summary as Record<string, unknown>;
        if (
          log.status === "success" &&
          summary?.processed === 0 &&
          !summary?.reason
        ) {
          alerts.push({
            severity: "warning",
            agent: log.agent_name,
            message: `Agent ${log.agent_name} processed 0 records with no skip reason.`,
            details: log.summary,
            timestamp: log.run_at,
          });
        }

        // Flag high error rates
        if (
          summary?.errors &&
          summary?.processed &&
          typeof summary.errors === "number" &&
          typeof summary.processed === "number" &&
          summary.processed > 0
        ) {
          const errorRate = summary.errors / (summary.processed + summary.errors);
          if (errorRate > 0.2) {
            alerts.push({
              severity: "warning",
              agent: log.agent_name,
              message: `Agent ${log.agent_name} has high error rate: ${Math.round(errorRate * 100)}%`,
              details: log.summary,
              timestamp: log.run_at,
            });
          }
        }
      }

      // Check for missing agents — every agent should have run in 24 hours
      const expectedAgents = [
        "ticker-enrichment-agent",
        "news-agent",
        "seo-content-writer-agent",
        "entity-optimizer-agent",
        "ai-seo-agent",
        "meta-optimizer-agent",
        "translation-es-agent",
        "geo-content-optimizer-agent",
        "indexing-agent",
        "on-page-auditor-agent",
        "content-refresher-agent",
        "rank-tracker-agent",
        "serp-analysis-agent",
        "content-gap-analysis-agent",
      ];

      const ranAgents = new Set(logs.map((l) => l.agent_name));
      for (const expected of expectedAgents) {
        if (!ranAgents.has(expected)) {
          alerts.push({
            severity: "warning",
            agent: expected,
            message: `Agent ${expected} did not run in the last 24 hours.`,
            timestamp: new Date().toISOString(),
          });
        }
      }
    }

    // Write all alerts to agent_knowledge table for admin dashboard
    if (alerts.length > 0) {
      await seo.from("agent_knowledge").upsert({
        agent_name: "alert-manager-agent",
        knowledge_type: "alerts",
        key: `alerts_${new Date().toISOString().split("T")[0]}`,
        value: { alerts, total: alerts.length },
        confidence_score: 1.0,
        observations: alerts.length,
      });
    }

    await logRun(seo, "alert-manager-agent", "success", {
      alerts_generated: alerts.length,
      logs_reviewed: logs?.length ?? 0,
    });

    return jsonResponse({ status: "success", alerts_generated: alerts.length });

  } catch (err) {
    console.error("alert-manager-agent fatal error:", err);
    return errorResponse(err instanceof Error ? err.message : "Unknown error");
  }
});

interface Alert {
  severity: "error" | "warning" | "info";
  agent: string;
  message: string;
  details?: unknown;
  timestamp: string;
}
