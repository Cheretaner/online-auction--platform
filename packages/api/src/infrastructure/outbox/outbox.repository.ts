import { query, queryAll, queryOne } from "../../infrastructure/database/query.js";
import type { DomainEventType } from "../../kernel/events.js";

export interface OutboxMessage {
  id: string;
  aggregateType: string;
  aggregateId: string;
  eventType: DomainEventType | string;
  payload: Record<string, unknown>;
  attemptCount: number;
}

export async function enqueueOutbox(input: {
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: Record<string, unknown>;
}): Promise<void> {
  await query(
    `INSERT INTO outbox_messages (aggregate_type, aggregate_id, event_type, payload)
     VALUES ($1, $2, $3, $4::jsonb)`,
    [input.aggregateType, input.aggregateId, input.eventType, JSON.stringify(input.payload)],
  );
}

export async function claimOutboxBatch(limit = 50): Promise<OutboxMessage[]> {
  const rows = await queryAll<{
    id: string;
    aggregate_type: string;
    aggregate_id: string;
    event_type: string;
    payload: Record<string, unknown>;
    attempt_count: number;
  }>(
    `WITH next AS (
       SELECT id
       FROM outbox_messages
       WHERE processed_at IS NULL
         AND available_at <= NOW()
       ORDER BY created_at
       FOR UPDATE SKIP LOCKED
       LIMIT $1
     )
     UPDATE outbox_messages o
        SET attempt_count = o.attempt_count + 1
       FROM next
      WHERE o.id = next.id
     RETURNING o.id, o.aggregate_type, o.aggregate_id, o.event_type, o.payload, o.attempt_count`,
    [limit],
  );

  return rows.map((row) => ({
    id: row.id,
    aggregateType: row.aggregate_type,
    aggregateId: row.aggregate_id,
    eventType: row.event_type,
    payload: row.payload,
    attemptCount: row.attempt_count,
  }));
}

export async function markOutboxProcessed(id: string): Promise<void> {
  await query(`UPDATE outbox_messages SET processed_at = NOW(), last_error = NULL WHERE id = $1`, [id]);
}

export async function markOutboxFailed(id: string, error: string): Promise<void> {
  await query(
    `UPDATE outbox_messages
        SET last_error = $2,
            available_at = NOW() + LEAST(INTERVAL '15 minutes', (attempt_count * INTERVAL '20 seconds'))
      WHERE id = $1`,
    [id, error.slice(0, 2000)],
  );
}

export async function getOutbox(id: string) {
  return queryOne(`SELECT * FROM outbox_messages WHERE id = $1`, [id]);
}
