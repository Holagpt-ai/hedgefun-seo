import { createServerClient } from "@/lib/supabase";

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

export default async function LogsPage() {
  const seo = createServerClient();

  const { data: logs } = await seo
    .from("agent_logs")
    .select("agent_name, status, records_processed, metadata, error_message, run_at")
    .order("run_at", { ascending: false })
    .limit(100);

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Agent Logs</h1>
        <p className="text-zinc-500 text-sm mt-1">Last 100 runs across all agents</p>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-zinc-500 text-xs uppercase tracking-wide">
              <th className="text-left px-5 py-3">Agent</th>
              <th className="text-left px-5 py-3">Status</th>
              <th className="text-right px-5 py-3">Processed</th>
              <th className="text-right px-5 py-3">Errors</th>
              <th className="text-left px-5 py-3">Details</th>
              <th className="text-right px-5 py-3">Run At</th>
            </tr>
          </thead>
          <tbody>
            {(logs ?? []).map((log, i) => {
              const meta = log.metadata as any;
              return (
                <tr key={i} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                  <td className="px-5 py-3 text-zinc-200 font-mono text-xs">{log.agent_name}</td>
                  <td className="px-5 py-3"><StatusPill status={log.status} /></td>
                  <td className="px-5 py-3 text-right text-zinc-300">{meta?.processed ?? "—"}</td>
                  <td className="px-5 py-3 text-right text-red-400">{meta?.errors ?? "—"}</td>
                  <td className="px-5 py-3 text-zinc-500 text-xs max-w-xs truncate">
                    {log.error_message ?? (meta?.reason ? `Skipped: ${meta.reason}` : "—")}
                  </td>
                  <td className="px-5 py-3 text-right text-zinc-500 text-xs">
                    {new Date(log.run_at).toLocaleString("en-US", { dateStyle: "short", timeStyle: "short" })}
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
