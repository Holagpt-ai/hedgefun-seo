import { createServerClient } from "@/lib/supabase";

export default async function AlertsPage() {
  const seo = createServerClient();

  const { data: logs } = await seo
    .from("agent_logs")
    .select("agent_name, status, metadata, run_at")
    .order("run_at", { ascending: false })
    .limit(200);

  const alerts: { severity: string; agent: string; message: string; time: string }[] = [];

  for (const log of logs ?? []) {
    const meta = log.metadata as any;
    if (log.status === "error") {
      alerts.push({ severity: "error", agent: log.agent_name, message: `Agent reported error status`, time: log.run_at });
    }
    if (log.status === "success" && meta?.processed === 0 && !meta?.reason) {
      alerts.push({ severity: "warning", agent: log.agent_name, message: `Processed 0 records with no skip reason`, time: log.run_at });
    }
    if (typeof meta?.errors === "number" && typeof meta?.processed === "number" && meta.processed > 0) {
      const rate = meta.errors / (meta.processed + meta.errors);
      if (rate > 0.2) {
        alerts.push({ severity: "warning", agent: log.agent_name, message: `High error rate: ${Math.round(rate * 100)}%`, time: log.run_at });
      }
    }
  }

  const severityStyle: Record<string, string> = {
    error: "border-l-red-500 bg-red-500/5",
    warning: "border-l-yellow-500 bg-yellow-500/5",
  };
  const badgeStyle: Record<string, string> = {
    error: "bg-red-500/20 text-red-400 border border-red-500/30",
    warning: "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30",
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Alerts</h1>
        <p className="text-zinc-500 text-sm mt-1">{alerts.length} active alerts from last 200 runs</p>
      </div>

      {alerts.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-10 text-center">
          <p className="text-green-400 font-semibold">All clear</p>
          <p className="text-zinc-500 text-sm mt-1">No alerts detected in recent runs</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert, i) => (
            <div key={i} className={`border border-zinc-800 border-l-4 rounded-lg px-5 py-4 ${severityStyle[alert.severity]}`}>
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${badgeStyle[alert.severity]}`}>
                    {alert.severity}
                  </span>
                  <span className="text-zinc-200 text-sm font-mono">{alert.agent}</span>
                </div>
                <span className="text-zinc-600 text-xs shrink-0">
                  {new Date(alert.time).toLocaleString("en-US", { dateStyle: "short", timeStyle: "short" })}
                </span>
              </div>
              <p className="text-zinc-400 text-sm mt-2">{alert.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
