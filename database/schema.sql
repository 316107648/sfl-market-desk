CREATE TABLE IF NOT EXISTS app_state (
  profile_id TEXT NOT NULL,
  namespace TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (profile_id, namespace)
);

CREATE TABLE IF NOT EXISTS farm_snapshots (
  id BIGSERIAL PRIMARY KEY,
  farm_id TEXT NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL,
  snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_farm_snapshots_farm_time
  ON farm_snapshots (farm_id, fetched_at DESC);
