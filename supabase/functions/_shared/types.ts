export interface TickerRow {
  id: string;
  ticker: string;
  company_name: string | null;
  type: "stock" | "etf" | "ipo";
  exchange: string | null;
  sector: string | null;
  industry: string | null;
  market_cap: number | null;
  description_en: string | null;
  description_es: string | null;
  meta_title_en: string | null;
  meta_title_es: string | null;
  meta_description_en: string | null;
  meta_description_es: string | null;
  entity_data: EntityData | null;
  llm_optimized_summary: string | null;
  geo_variants: GeoVariants | null;
  serp_data: SerpData | null;
  enriched_at: string | null;
  indexed_at: string | null;
  audited_at: string | null;
  refreshed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface EntityData {
  ceo: string | null;
  founded: string | null;
  headquarters: string | null;
  employees: number | null;
  website: string | null;
  competitors: string[];
  related_tickers: string[];
  tags: string[];
}

export interface GeoVariants {
  mx: { title: string; description: string } | null;
  co: { title: string; description: string } | null;
  es: { title: string; description: string } | null;
}

export interface SerpData {
  top_keywords: string[];
  avg_position: number | null;
  competitor_urls: string[];
  last_checked: string;
}

export interface NewsRow {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  content: string | null;
  author: string | null;
  source: string | null;
  image_url: string | null;
  article_url: string;
  tickers: string[];
  published_at: string | null;
  indexed_at: string | null;
  created_at: string;
}

export interface AgentLog {
  id: string;
  agent_name: string;
  status: "success" | "error" | "skipped";
  summary: Record<string, unknown>;
  run_at: string;
}

export interface AgentQueueItem {
  id: string;
  agent_name: string;
  payload: Record<string, unknown>;
  status: "pending" | "running" | "done" | "failed";
  priority: number;
  created_at: string;
  updated_at: string;
}

export interface AgentKnowledge {
  id: string;
  agent_name: string;
  knowledge_type: string;
  key: string;
  value: Record<string, unknown>;
  confidence_score: number;
  observations: number;
  created_at: string;
  updated_at: string;
}

export interface PolygonTickerDetail {
  ticker: string;
  name: string;
  description: string | null;
  market_cap: number | null;
  primary_exchange: string | null;
  type: string | null;
  sic_code: string | null;
  sic_description: string | null;
  total_employees: number | null;
  list_date: string | null;
  homepage_url: string | null;
  address: {
    city: string | null;
    state: string | null;
    country: string | null;
  } | null;
  branding: {
    logo_url: string | null;
    icon_url: string | null;
  } | null;
}

export interface PolygonNewsArticle {
  id: string;
  title: string;
  description: string | null;
  article_url: string;
  image_url: string | null;
  author: string | null;
  published_utc: string;
  tickers: string[];
  publisher: {
    name: string;
    homepage_url: string | null;
  };
}

export interface AgentResult {
  agent: string;
  status: "success" | "error" | "skipped";
  processed: number;
  errors: number;
  message: string;
}
