import type pg from "pg";
import { getPool } from "./pool.js";
import { dbSession } from "./session.js";

export interface TransactionContext {
  userId?: string;
  organizationId?: string;
}

async function applySessionSettings(
  client: pg.PoolClient,
  context: TransactionContext,
): Promise<void> {
  if (context.userId) {
    await client.query(
      "SELECT set_config('app.current_user_id', $1, true)",
      [context.userId],
    );
  }

  if (context.organizationId) {
    await client.query(
      "SELECT set_config('app.current_org_id', $1, true)",
      [context.organizationId],
    );
  }
}

function validateNestedContext(
  existing: TransactionContext,
  requested?: TransactionContext,
): void {
  if (!requested) {
    return;
  }

  if (
    requested.userId &&
    existing.userId &&
    requested.userId !== existing.userId
  ) {
    throw new Error(
      "Nested transaction cannot change the authenticated user",
    );
  }

  if (
    requested.organizationId &&
    existing.organizationId &&
    requested.organizationId !== existing.organizationId
  ) {
    throw new Error(
      "Nested transaction cannot change the organization context",
    );
  }
}

export async function withTransaction<T>(
  fn: (client: pg.PoolClient) => Promise<T>,
  context?: TransactionContext,
): Promise<T> {
  const existing = dbSession.getStore();

  /*
   * Nested transaction

   * PostgreSQL does not automatically give us independent
   * nested transactions here.
   *
   * If a transaction already exists, reuse its connection.
   */
  if (existing) {
    validateNestedContext(existing, context);

    return fn(existing.client);
  }

  
    // New transaction
  const client = await getPool().connect();

  try {
    await client.query("BEGIN");

    /*
     * IMPORTANT:
     * set_config(..., true) is equivalent to SET LOCAL.
     * Therefore these values exist only for this transaction.
     */
    await applySessionSettings(client, context ?? {});

    return await dbSession.run(
      {
        client,
        userId: context?.userId,
        organizationId: context?.organizationId,
      },
      async () => {
        try {
          const result = await fn(client);

          await client.query("COMMIT");

          return result;
        } catch (error) {
          try {
            await client.query("ROLLBACK");
          } catch (rollbackError) {
            /*
             * Do not replace the original business/database
             * error with a rollback error.
             */
            void rollbackError;
          }

          throw error;
        }
      },
    );
  } finally {
    client.release();
  }
}