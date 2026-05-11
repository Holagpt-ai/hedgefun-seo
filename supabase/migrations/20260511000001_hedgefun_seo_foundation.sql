-- ─────────────────────────────────────────────
-- HedgeFun SEO — Foundation Schema
-- Run this in the hedgefun-seo Supabase SQL Editor
-- ─────────────────────────────────────────────

-- Core ticker registry (stocks + ETFs + IPOs)
CREATE TABLE IF NOT EXISTS seo_tickers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker text NOT NULL UNIQUE,
  company_name text,
  type text NOT NULL CHECK (type IN ('stock', 'etf', 'ipo')),
  exchange text,
  sector text,
  industry text,
  sic_code text,
  country text DEFAULT 'US',
  description_en text,
  description_es text,
  market_cap bigint,
  employees integer,
  ceo text,
  website text,
  logo_url text,
  -- SEO fields
  meta_title_en text,
  meta_title_es text,
  meta_description_en text,
  meta_description_es text,
  schema_json jsonb,
  -- Status tracking
  enriched_at timestamptz,
  indexed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- News articles for /news/[slug] pages
CREATE TABLE IF NOT EXISTS seo_news (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  ticker text,
  title_en text,
  title_es text,
  summary_en text,
  summary_es text,
  source text,
  source_url text,
  image_url text,
  published_at timestamptz,
  indexed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Agent run logs
CREATE TABLE IF NOT EXISTS agent_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name text NOT NULL,
  run_at timestamptz NOT NULL DEFAULT now(),
  records_processed integer NOT NULL DEFAULT 0,
  status text NOT NULL CHECK (status IN ('success', 'partial', 'error', 'skipped')),
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'
);

-- Agent queue (inter-agent messaging)
CREATE TABLE IF NOT EXISTS agent_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_agent text NOT NULL,
  to_agent text NOT NULL,
  job_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending',
  priority integer NOT NULL DEFAULT 5,
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  created_at timestamptz NOT NULL DEFAULT now(),
  picked_at timestamptz,
  completed_at timestamptz,
  error_message text
);

-- Dead letter queue
CREATE TABLE IF NOT EXISTS dead_letter_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_job_id uuid,
  from_agent text NOT NULL,
  to_agent text NOT NULL,
  job_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  error_message text,
  failed_at timestamptz NOT NULL DEFAULT now(),
  acknowledged boolean NOT NULL DEFAULT false
);

-- Agent shared memory
CREATE TABLE IF NOT EXISTS agent_knowledge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name text NOT NULL,
  knowledge_type text NOT NULL,
  key text NOT NULL,
  value jsonb NOT NULL,
  confidence_score numeric(4,3) DEFAULT 0.5,
  observations integer DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(agent_name, knowledge_type, key)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_seo_tickers_type ON seo_tickers(type);
CREATE INDEX IF NOT EXISTS idx_seo_tickers_indexed ON seo_tickers(indexed_at) WHERE indexed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_seo_tickers_enriched ON seo_tickers(enriched_at) WHERE enriched_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_seo_tickers_market_cap ON seo_tickers(market_cap DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_seo_news_slug ON seo_news(slug);
CREATE INDEX IF NOT EXISTS idx_seo_news_indexed ON seo_news(indexed_at) WHERE indexed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_agent_logs_agent_run ON agent_logs(agent_name, run_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_queue_status ON agent_queue(status, priority DESC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_agent_knowledge_lookup ON agent_knowledge(agent_name, knowledge_type, key);
