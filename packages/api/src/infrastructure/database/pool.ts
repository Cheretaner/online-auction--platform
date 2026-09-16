import pg from "pg";
import { env } from "../../config/env.js";
import { logger } from "../../shared/utils/logger.js";

const { Pool } = pg;

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  if (!pool) {
    if (!env.DATABASE_URL) {
      throw new Error("DATABASE_URL is required for database operations");
    }
    pool = new Pool({
      connectionString: env.DATABASE_URL,
      max: env.DATABASE_POOL_MAX,
      ssl: env.DATABASE_SSL ? { rejectUnauthorized: false } : undefined,
    });
    pool.on("error", (err) => logger.error({ err }, "Unexpected database pool error"));
  }
  return pool;
}

export async function pingDatabase(): Promise<boolean> {
  if (!env.DATABASE_URL) return false;
  const result = await getPool().query<{ ok: number | string }>("SELECT 1 AS ok");
  return Number(result.rows[0]?.ok) === 1;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
