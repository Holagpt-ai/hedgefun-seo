import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import postgres from "npm:postgres@3";

// ── Direct Postgres client (bypasses Supabase JS auth layer) ─────────────────
function getSql() {
  const url = Deno.env.get("DATABASE_URL")!;
  return postgres(url, { max: 3, idle_timeout: 20, connect_timeout: 10 });
}

// ── Types ─────────────────────────────────────────────────────────────────────
type Row = Record<string, unknown>;

interface QueryResult {
  data: Row[] | null;
  error: { message: string } | null;
}

// ── Chainable query builder ───────────────────────────────────────────────────
class QueryBuilder {
  private _table: string;
  private _selectCols = "*";
  private _filters: string[] = [];
  private _orderClauses: string[] = [];
  private _limitVal: number | null = null;
  private _operation: "select" | "insert" | "upsert" | "update" = "select";
  private _payload: Row | Row[] | null = null;
  private _onConflict: string | null = null;
  private _updatePayload: Row | null = null;

  constructor(table: string) {
    this._table = table;
  }

  select(cols: string): this {
    this._operation = "select";
    this._selectCols = cols;
    return this;
  }

  insert(payload: Row): this {
    this._operation = "insert";
    this._payload = payload;
    return this;
  }

  upsert(payload: Row | Row[], opts?: { onConflict?: string }): this {
    this._operation = "upsert";
    this._payload = payload;
    this._onConflict = opts?.onConflict ?? null;
    return this;
  }

  update(payload: Row): this {
    this._operation = "update";
    this._updatePayload = payload;
    return this;
  }

  eq(col: string, val: unknown): this {
    this._filters.push(`"${col}" = ${sqlLiteral(val)}`);
    return this;
  }

  is(col: string, val: null): this {
    this._filters.push(`"${col}" IS NULL`);
    return this;
  }

  not(col: string, operator: string, val: unknown): this {
    if (operator === "is" && val === null) {
      this._filters.push(`"${col}" IS NOT NULL`);
    } else {
      this._filters.push(`NOT "${col}" = ${sqlLiteral(val)}`);
    }
    return this;
  }

  in(col: string, vals: unknown[]): this {
    const list = vals.map((v) => sqlLiteral(v)).join(", ");
    this._filters.push(`"${col}" IN (${list})`);
    return this;
  }

  gte(col: string, val: unknown): this {
    this._filters.push(`"${col}" >= ${sqlLiteral(val)}`);
    return this;
  }

  lte(col: string, val: unknown): this {
    this._filters.push(`"${col}" <= ${sqlLiteral(val)}`);
    return this;
  }

  or(filter: string): this {
    const parts = filter.split(",").map((part) => {
      const [col, op, ...rest] = part.trim().split(".");
      const val = rest.join(".");
      if (op === "is" && val === "null") return `"${col}" IS NULL`;
      if (op === "lt") return `"${col}" < ${sqlLiteral(val)}`;
      if (op === "lte") return `"${col}" <= ${sqlLiteral(val)}`;
      if (op === "gt") return `"${col}" > ${sqlLiteral(val)}`;
      if (op === "gte") return `"${col}" >= ${sqlLiteral(val)}`;
      if (op === "eq") return `"${col}" = ${sqlLiteral(val)}`;
      return `"${col}" IS NULL`;
    });
    this._filters.push(`(${parts.join(" OR ")})`);
    return this;
  }

  filterRaw(expression: string): this {
    this._filters.push(expression);
    return this;
  }

  order(col: string, opts?: { ascending?: boolean; nullsFirst?: boolean }): this {
    const dir = opts?.ascending === false ? "DESC" : "ASC";
    const nulls = opts?.nullsFirst === false ? "NULLS LAST" : "NULLS FIRST";
    this._orderClauses.push(`"${col}" ${dir} ${nulls}`);
    return this;
  }

  limit(n: number): this {
    this._limitVal = n;
    return this;
  }

  then(
    resolve: (result: QueryResult) => void,
    reject: (err: unknown) => void
  ): void {
    this._execute().then(resolve).catch(reject);
  }

  async _execute(): Promise<QueryResult> {
    const sql = getSql();
    try {
      if (this._operation === "select") {
        const cols =
          this._selectCols === "*"
            ? "*"
            : this._selectCols
                .split(",")
                .map((c) => `"${c.trim()}"`)
                .join(", ");
        let query = `SELECT ${cols} FROM "${this._table}"`;
        if (this._filters.length) query += ` WHERE ${this._filters.join(" AND ")}`;
        if (this._orderClauses.length) query += ` ORDER BY ${this._orderClauses.join(", ")}`;
        if (this._limitVal !== null) query += ` LIMIT ${this._limitVal}`;
        const rows = await sql.unsafe(query);
        return { data: rows as Row[], error: null };
      }

      if (this._operation === "insert") {
        const payload = this._payload as Row;
        const keys = Object.keys(payload);
        const cols = keys.map((k) => `"${k}"`).join(", ");
        const vals = keys.map((k) => sqlLiteral(payload[k])).join(", ");
        await sql.unsafe(`INSERT INTO "${this._table}" (${cols}) VALUES (${vals})`);
        return { data: null, error: null };
      }

      if (this._operation === "upsert") {
        const rows = Array.isArray(this._payload)
          ? this._payload
          : [this._payload as Row];
        for (const payload of rows) {
          const keys = Object.keys(payload);
          const cols = keys.map((k) => `"${k}"`).join(", ");
          const vals = keys.map((k) => sqlLiteral(payload[k])).join(", ");
          const conflict = this._onConflict
            ? `"${this._onConflict}"`
            : keys.map((k) => `"${k}"`).join(", ");
          const updates = keys
            .filter((k) => k !== this._onConflict)
            .map((k) => `"${k}" = EXCLUDED."${k}"`)
            .join(", ");
          await sql.unsafe(
            `INSERT INTO "${this._table}" (${cols}) VALUES (${vals})
             ON CONFLICT (${conflict}) DO UPDATE SET ${updates}`
          );
        }
        return { data: null, error: null };
      }

      if (this._operation === "update") {
        const payload = this._updatePayload as Row;
        const sets = Object.entries(payload)
          .map(([k, v]) => `"${k}" = ${sqlLiteral(v)}`)
          .join(", ");
        let query = `UPDATE "${this._table}" SET ${sets}`;
        if (this._filters.length) query += ` WHERE ${this._filters.join(" AND ")}`;
        await sql.unsafe(query);
        return { data: null, error: null };
      }

      return { data: null, error: { message: "Unknown operation" } };
    } catch (err) {
      return {
        data: null,
        error: { message: err instanceof Error ? err.message : String(err) },
      };
    } finally {
      await sql.end();
    }
  }
}

// ── Pseudo-client ─────────────────────────────────────────────────────────────
class DirectClient {
  from(table: string): QueryBuilder {
    return new QueryBuilder(table);
  }
}

export function createSeoClient(): DirectClient {
  return new DirectClient();
}

// ── Source client (Lovable Supabase — anon key is valid eyJ JWT) ──────────────
export function createSourceClient(): SupabaseClient {
  return createClient(
    Deno.env.get("HF_SOURCE_SUPABASE_URL")!,
    Deno.env.get("HF_SOURCE_SUPABASE_ANON_KEY")!
  );
}

// ── Polygon helper ────────────────────────────────────────────────────────────
export async function polygonGet(path: string): Promise<any> {
  const apiKey = Deno.env.get("POLYGON_API_KEY")!;
  const url = `https://api.polygon.io${path}${
    path.includes("?") ? "&" : "?"
  }apiKey=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Polygon ${path} → ${res.status}`);
  return res.json();
}

// ── logRun ────────────────────────────────────────────────────────────────────
export async function logRun(
  seo: DirectClient,
  agent: string,
  status: "success" | "error" | "skipped",
  metadata: Record<string, unknown>
): Promise<void> {
  await seo.from("agent_logs").insert({
    agent_name: agent,
    status,
    metadata,
    run_at: new Date().toISOString(),
  });
}

// ── SQL literal serializer ────────────────────────────────────────────────────
function sqlLiteral(val: unknown): string {
  if (val === null || val === undefined) return "NULL";
  if (typeof val === "number") return String(val);
  if (typeof val === "boolean") return val ? "TRUE" : "FALSE";
  if (typeof val === "object")
    return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
  return `'${String(val).replace(/'/g, "''")}'`;
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────
export function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
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
