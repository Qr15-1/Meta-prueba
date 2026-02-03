CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  brand_key TEXT UNIQUE NOT NULL,
  brand_name TEXT,
  ad_account_id TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS daily_metrics (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  brand_key TEXT NOT NULL,
  date DATE NOT NULL,
  metrics_json JSONB,
  campaigns_json JSONB,
  ads_json JSONB,
  best_costs_json JSONB,
  delivered_ads_count INTEGER DEFAULT 0,
  note TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS daily_metrics_brand_date_idx
  ON daily_metrics (brand_key, date);
