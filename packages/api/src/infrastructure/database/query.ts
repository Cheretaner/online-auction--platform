import type pg from "pg";
import { getPool } from "./pool.js";

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[],
  client?: pg.Pool | pg.PoolClient,
): Promise<pg.QueryResult<T>> {
  const executor = client ?? getPool();
  return executor.query<T>(text, params);
}
