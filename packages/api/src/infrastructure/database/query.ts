import type pg from "pg";
import { getPool } from "./pool.js";
import { getDbSession } from "./session.js";

export type Queryable = pg.Pool | pg.PoolClient;

export function getExecutor(client?: Queryable): Queryable {
  return client ?? getDbSession()?.client ?? getPool();
}

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[],
  client?: Queryable,
): Promise<pg.QueryResult<T>> {
  return getExecutor(client).query<T>(text, params);
}

export async function queryAll<
  T extends pg.QueryResultRow = pg.QueryResultRow,
>(
  text: string,
  params?: unknown[],
  client?: Queryable,
): Promise<T[]> {
  const result = await query<T>(text, params, client);
  return result.rows;
}

export async function queryOne<
  T extends pg.QueryResultRow = pg.QueryResultRow,
>(
  text: string,
  params?: unknown[],
  client?: Queryable,
): Promise<T | null> {
  const rows = await queryAll<T>(text, params, client);
  return rows[0] ?? null;
}