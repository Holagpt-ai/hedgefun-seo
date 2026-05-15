import { createServerClient } from "@/lib/supabase";

export default async function ReportsPage() {
  const seo = createServerClient();

  const { data: rows } = await seo
    .from("agent_knowledge")
    .select("value, created_at")
    .eq("knowledge_type", "gap_analysis")
    .order("created_at", { ascending: false })
    .limit(1);

  const gap = rows?.[0]?.value as any;

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Reports</h1>
        <p className="text-zinc-500 text-sm mt-1">Content gap analysis — latest run</p>
      </div>

      {!gap ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-10 text-center">
          <p className="text-zinc-500">No gap analysis data available yet</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
            {[
              { label: "Source tickers", value: gap.total_source_tickers ?? "—", color: "border-l-blue-500" },
              { label: "SEO pages built", value: gap.total_seo_tickers ?? "—", color: "border-l-green-500" },
              { label: "Coverage gaps", value: gap.total_gaps ?? "—", color: "border-l-red-500" },
              { label: "Last analyzed", value: gap.last_analyzed ? new Date(gap.last_analyzed).toLocaleDateString() : "—", color: "border-l-zinc-500" },
            ].map((card) => (
              <div key={card.label} className={`bg-zinc-900 border border-zinc-800 rounded-lg p-5 border-l-4 ${card.color}`}>
                <p className="text-3xl font-bold text-white">{card.value}</p>
                <p className="text-zinc-400 text-sm mt-1">{card.label}</p>
              </div>
            ))}
          </div>

          <h2 className="text-lg font-semibold text-white mb-4">Top Missing by Market Cap</h2>
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-500 text-xs uppercase tracking-wide">
                  <th className="text-left px-5 py-3">#</th>
                  <th className="text-left px-5 py-3">Ticker</th>
                  <th className="text-left px-5 py-3">Company</th>
                  <th className="text-left px-5 py-3">Type</th>
                  <th className="text-right px-5 py-3">Market Cap</th>
                </tr>
              </thead>
              <tbody>
                {(gap.top_missing_by_market_cap ?? []).map((row: any, i: number) => (
                  <tr key={i} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                    <td className="px-5 py-3 text-zinc-600 text-xs">{i + 1}</td>
                    <td className="px-5 py-3 text-green-400 font-mono font-semibold text-xs">{row.ticker}</td>
                    <td className="px-5 py-3 text-zinc-200">{row.name}</td>
                    <td className="px-5 py-3 text-zinc-500 text-xs">{row.type}</td>
                    <td className="px-5 py-3 text-right text-zinc-300">
                      ${(row.market_cap / 1e9).toFixed(1)}B
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
