import { createServerClient } from "@/lib/supabase";

const INDEXNOW_KEY = process.env.INDEXNOW_KEY!;
const SITE_HOST = "hedgefun.fun";
const BATCH_SIZE = 100;

async function submitToIndexNow(urls: string[]): Promise<{ submitted: number; errors: number }> {
  const res = await fetch("https://api.indexnow.org/IndexNow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      host: SITE_HOST,
      key: INDEXNOW_KEY,
      keyLocation: `https://${SITE_HOST}/${INDEXNOW_KEY}.txt`,
      urlList: urls,
    }),
  });
  if (res.ok || res.status === 202) {
    return { submitted: urls.length, errors: 0 };
  }
  return { submitted: 0, errors: urls.length };
}

export async function GET() {
  const supabase = createServerClient();
  const runAt = new Date().toISOString();

  try {
    const { data: tickers } = await supabase
      .from("seo_tickers")
      .select("id, ticker, type")
      .is("indexed_at", null)
      .not("enriched_at", "is", null)
      .order("created_at", { ascending: true })
      .limit(BATCH_SIZE);

    if (!tickers || tickers.length === 0) {
      await supabase.from("agent_logs").insert({
        agent_name: "indexing-agent",
        run_at: runAt,
        records_processed: 0,
        status: "skipped",
        metadata: { reason: "no_pending_urls" },
      });
      return Response.json({ ok: true, submitted: 0, message: "No URLs to index" });
    }

    const urls = tickers.map((t) => {
      if (t.type === "etf") return `https://${SITE_HOST}/etf/${t.ticker}`;
      if (t.type === "ipo") return `https://${SITE_HOST}/ipos/${t.ticker}`;
      return `https://${SITE_HOST}/stocks/${t.ticker}`;
    });

    const { submitted, errors } = await submitToIndexNow(urls);

    if (submitted > 0) {
      const ids = tickers.map((t) => t.id);
      await supabase
        .from("seo_tickers")
        .update({ indexed_at: new Date().toISOString() })
        .in("id", ids);
    }

    await supabase.from("agent_logs").insert({
      agent_name: "indexing-agent",
      run_at: runAt,
      records_processed: submitted,
      status: errors > 0 ? "partial" : "success",
      metadata: { submitted, errors },
    });

    return Response.json({ ok: true, submitted, errors });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await supabase.from("agent_logs").insert({
      agent_name: "indexing-agent",
      run_at: runAt,
      records_processed: 0,
      status: "error",
      error_message: msg,
      metadata: {},
    });
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}
