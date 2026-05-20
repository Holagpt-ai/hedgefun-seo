const SEO_FUNCTION_BASE = "https://rmbkntshgzkkmsyngveo.supabase.co/functions/v1";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const AGENTS = [
  "ticker-enrichment-agent",
  "entity-optimizer-agent",
  "ai-seo-agent",
  "meta-optimizer-agent",
  "indexing-agent",
];

async function invokeAgent(name: string): Promise<{ name: string; result: any; error?: string }> {
  try {
    const res = await fetch(`${SEO_FUNCTION_BASE}/${name}`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    const result = await res.json();
    return { name, result };
  } catch (err) {
    return { name, result: null, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function GET() {
  const results = [];

  for (const agent of AGENTS) {
    const outcome = await invokeAgent(agent);
    results.push(outcome);
    // Stop chaining if enrichment found nothing new
    if (agent === "ticker-enrichment-agent" && outcome.result?.status === "skipped") {
      break;
    }
  }

  return Response.json({ ok: true, ran_at: new Date().toISOString(), results });
}
