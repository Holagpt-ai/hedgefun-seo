export type Locale = "en" | "es";

export type TickerRow = {
  id: string;
  ticker: string;
  company_name: string | null;
  type: "stock" | "etf" | "ipo";
  exchange: string | null;
  sector: string | null;
  industry: string | null;
  description_en: string | null;
  description_es: string | null;
  market_cap: number | null;
  employees: number | null;
  ceo: string | null;
  website: string | null;
  country: string | null;
  sic_code: string | null;
  logo_url: string | null;
  meta_title_en: string | null;
  meta_title_es: string | null;
  meta_description_en: string | null;
  meta_description_es: string | null;
  schema_json: Record<string, unknown> | null;
  indexed_at: string | null;
  enriched_at: string | null;
  created_at: string;
  updated_at: string;
};

export type NewsRow = {
  id: string;
  slug: string;
  ticker: string | null;
  title_en: string | null;
  title_es: string | null;
  summary_en: string | null;
  summary_es: string | null;
  source: string | null;
  source_url: string | null;
  image_url: string | null;
  published_at: string | null;
  indexed_at: string | null;
  created_at: string;
};

export type AgentLogRow = {
  id: string;
  agent_name: string | null;
  run_at: string;
  records_processed: number | null;
  status: string | null;
  error_message: string | null;
  metadata: Record<string, unknown> | null;
};
