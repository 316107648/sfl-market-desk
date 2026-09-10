import "server-only";
import { Pool } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __sflPool: Pool | undefined;
}

function connectionString() {
  return process.env.DATABASE_URL?.trim() || "";
}

export function cloudDatabaseConfigured() {
  return Boolean(connectionString());
}

export function getPool() {
  const url = connectionString();
  if (!url) throw new Error("DATABASE_URL não configurada.");

  if (!global.__sflPool) {
    global.__sflPool = new Pool({
      connectionString: url,
      ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
      max: 5,
    });
  }

  return global.__sflPool;
}

export async function ensureCloudSchema() {
  const pool = getPool();
  await pool.query(`
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
  `);
}
