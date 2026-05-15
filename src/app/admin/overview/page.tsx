import { createServerClient } from "@/lib/supabase";

const AGENTS = [
  "ticker-enrichment-agent","news-agent","seo-content-writer-agent",
  "entity-optimizer-agent","ai-seo-agent","meta-optimizer-agent",
  "translation-es-agent","geo-content-optimizer-agent","indexing-agent",
  "serp-analysis-agent","content-gap-analysis-agent","rank-tracker-agent",
  "on-page-auditor-agent","content-refresher-agent","alert-manager-agent",
];

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    success: "bg-green-500/20 text-green-400 border border-green-500/30",
    error: "bg-red-500/20 text-red-400 border border-red-500/30",
    skipped: "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30",
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${styles[status] ?? "bg-zinc-700 text-zinc-400"}`}>
      {status}
    </span>
  );
}

function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className={`bg-zinc-900 border border-zinc-800 rounded-lg p-5 border-l-4 ${color}`}>
      <p className="text-3xl font-bold text-white">{value}</p>
      <p className="text-zinc-400 text-sm mt-1">{label}</p>
    </div>
  );
}

export default async function OverviewPage() {
  const seo = createServerClient();

  const { data: logs } = await seo
    .from("agent_logs")
    .select("agent_name, status, records_processed, metadata, run_at")
    .order("run_at", { ascending: false })
    .limit(200);

  // Latest run per agent
  const latestByAgent: Record<string, any> = {};
  for (const log of logs ?? []) {
    if (!latestByAgent[log.agent_name]) {
      latestByAgent[log.agent_name] = log;
    }
  }

  const allLatest = Object.values(latestByAgent);
  const successCount = allLatest.filter((l) => l.status === "success").length;
  const errorCount = allLatest.filter((l) => l.status === "error").length;
  const skippedCount = allLatest.filter((l) => l.status === "skipped").length;

  const totalProcessed = (logs ?? []).reduce((sum, l) => {
    const meta = l.metadata as any;
    return sum + (meta?.processed ?? 0);
  }, 0);

  const lastRun = logs?.[0]?.run_at
    ? new Date(logs[0].run_at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })
    : "—";

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Overview</h1>
        <p className="text-zinc-500 text-sm mt-1">Last run: {lastRun}</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        <StatCard label="Agents healthy" value={successCount} color="border-l-green-500" />
        <StatCard label="Agents erroring" value={errorCount} color="border-l-red-500" />
        <StatCard label="Agents skipped" value={skippedCount} color="border-l-yellow-500" />
        <StatCard label="Records processed (all time)" value={totalProcessed.toLocaleString()} color="border-l-blue-500" />
      </div>

      {/* Agent health grid */}
      <h2 className="text-lg font-semibold text-white mb-4">Agent Health</h2>
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-zinc-500 text-xs uppercase tracking-wide">
              <th className="text-left px-5 py-3">Agent</th>
              <th className="text-left px-5 py-3">Status</th>
              <th className="text-right px-5 py-3">Processed</th>
              <th className="text-right px-5 py-3">Errors</th>
              <th className="text-right px-5 py-3">Last Run</th>
            </tr>
          </thead>
          <tbody>
            {AGENTS.map((name) => {
              const log = latestByAgent[name];
              const meta = log?.metadata as any;
              return (
                <tr key={name} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                  <td className="px-5 py-3 text-zinc-200 font-mono text-xs">{name}</td>
                  <td className="px-5 py-3">
                    {log ? <StatusPill status={log.status} /> : <span className="text-zinc-600 text-xs">no data</span>}
                  </td>
                  <td className="px-5 py-3 text-right text-zinc-300">{meta?.processed ?? "—"}</td>
                  <td className="px-5 py-3 text-right text-red-400">{meta?.errors ?? "—"}</td>
                  <td className="px-5 py-3 text-right text-zinc-500 text-xs">
                    {log ? new Date(log.run_at).toLocaleString("en-US", { dateStyle: "short", timeStyle: "short" }) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
