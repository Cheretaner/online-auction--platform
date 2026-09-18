import { AsyncLocalStorage } from "node:async_hooks";
import type pg from "pg";

export interface DbSession {
  client: pg.PoolClient;
  userId?: string;
  organizationId?: string;
}

export const dbSession = new AsyncLocalStorage<DbSession>();

export function getDbSession(): DbSession | undefined {
  return dbSession.getStore();
}