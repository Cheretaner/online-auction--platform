import type pg from "pg";
import { getPool } from "./pool.js";
import { dbSession } from "./session.js";

export interface TransactionContext {
  userId?: string;
  organizationId?: string;
  bypassRls?: boolean;
}

async function applySessionSettings(
  client: pg.PoolClient,
  context?: TransactionContext,
): Promise<void> {
  if (context?.userId) {
    await client.query("SELECT set_config('app.current_user_id', $1, true)", [context.userId]);
  }
  if (context?.organizationId) {
    await client.query("SELECT set_config('app.current_org_id', $1, true)", [context.organizationId]);
  }
  if (context?.bypassRls) {
    await client.query("SELECT set_config('app.bypass_rls', 'on', true)");
  }
}

export async function withTransaction<T>(
  fn: (client: pg.PoolClient) => Promise<T>,
  context?: TransactionContext,
): Promise<T> {
  const existing = dbSession.getStore();
  if (existing) {
    await applySessionSettings(existing.client, context);
    return fn(existing.client);
  }

  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await applySessionSettings(client, context);
    const result = await dbSession.run(
      {
        client,
        userId: context?.userId,
        organizationId: context?.organizationId,
      },
      () => fn(client),
    );
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
