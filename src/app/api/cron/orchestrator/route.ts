const SEO_FUNCTION_BASE = "https://rmbkntshgzkkmsyngveo.supabase.co/functions/v1";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET() {
  try {
    const res = await fetch(`${SEO_FUNCTION_BASE}/orchestrator`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: "{}",
    });

    const result = await res.json();
    return Response.json({ ok: true, ran_at: new Date().toISOString(), result });

  } catch (err) {
    return Response.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
