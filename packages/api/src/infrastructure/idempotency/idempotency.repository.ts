import { query, queryOne } from "../database/query.js";

export interface StoredIdempotency {
  requestHash: string;
  statusCode: number;
  response: unknown;
}

export async function findIdempotency(
  userId: string,
  key: string,
): Promise<StoredIdempotency | null> {
  const row = await queryOne<{
    request_hash: string;
    status_code: number;
    response: unknown;
  }>(
    `SELECT request_hash, status_code, response
       FROM idempotency_keys
      WHERE user_id = $1 AND key = $2 AND expires_at > NOW()`,
    [userId, key],
  );
  if (!row) return null;
  return {
    requestHash: row.request_hash,
    statusCode: row.status_code,
    response: row.response,
  };
}

export async function upsertIdempotency(input: {
  userId: string;
  key: string;
  method: string;
  path: string;
  requestHash: string;
  statusCode: number;
  response: unknown;
  ttlMs: number;
}): Promise<void> {
  await query(
    `INSERT INTO idempotency_keys (
        key, user_id, method, path, request_hash, status_code, response, expires_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, NOW() + ($8 || ' milliseconds')::interval)
     ON CONFLICT (user_id, key) DO UPDATE
        SET status_code = EXCLUDED.status_code,
            response = EXCLUDED.response,
            request_hash = EXCLUDED.request_hash,
            expires_at = EXCLUDED.expires_at`,
    [
      input.key,
      input.userId,
      input.method,
      input.path,
      input.requestHash,
      input.statusCode,
      JSON.stringify(input.response),
      String(input.ttlMs),
    ],
  );
}

export async function pruneExpiredIdempotencyKeys(): Promise<number> {
  const result = await query(`DELETE FROM idempotency_keys WHERE expires_at <= NOW()`);
  return result.rowCount ?? 0;
}
