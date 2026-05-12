ALTER TABLE seo_tickers
  ADD COLUMN IF NOT EXISTS entity_data jsonb,
  ADD COLUMN IF NOT EXISTS llm_optimized_summary text,
  ADD COLUMN IF NOT EXISTS geo_variants jsonb,
  ADD COLUMN IF NOT EXISTS serp_data jsonb,
  ADD COLUMN IF NOT EXISTS audited_at timestamptz,
  ADD COLUMN IF NOT EXISTS refreshed_at timestamptz;
