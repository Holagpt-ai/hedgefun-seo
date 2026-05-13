import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export function createSeoClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

export function createSourceClient(): SupabaseClient {
  return createClient(
    Deno.env.get("HF_SOURCE_SUPABASE_URL")!,
    Deno.env.get("HF_SOURCE_SUPABASE_ANON_KEY")!
  );
}

export async function polygonGet(path: string): Promise<any> {
  const apiKey = Deno.env.get("POLYGON_API_KEY")!;
  const url = `https://api.polygon.io${path}${path.includes("?") ? "&" : "?"}apiKey=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Polygon ${path} → ${res.status}`);
  return res.json();
}

export async function logRun(
  seo: SupabaseClient,
  agent: string,
  status: "success" | "error" | "skipped",
  summary: Record<string, unknown>
): Promise<void> {
  await seo.from("agent_logs").insert({
    agent_name: agent,
    status,
    metadata: summary,
    run_at: new Date().toISOString(),
  });
}

export function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
}

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(), "Content-Type": "application/json" },
  });
}

export function errorResponse(message: string, status = 500): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders(), "Content-Type": "application/json" },
  });
}
