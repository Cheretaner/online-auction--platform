import type { NotificationChannel, NotificationStatus } from "@auction/shared";
import { query, queryAll, queryOne } from "../infrastructure/database/query.js";
import { withTransaction } from "../infrastructure/database/tx.js";
import type { EnqueueNotificationInput, Notification } from "./notification.types.js";

interface DbNotification {
  id: string;
  user_id: string;
  channel: NotificationChannel;
  status: NotificationStatus;
  type: string;
  title: string;
  message: string;
  related_entity_type: string | null;
  related_entity_id: string | null;
  sent_at: Date | null;
  read_at: Date | null;
  failure_reason: string | null;
  created_at: Date;
}

function mapNotification(row: DbNotification): Notification {
  return {
    id: row.id,
    userId: row.user_id,
    channel: row.channel,
    status: row.status,
    type: row.type,
    title: row.title,
    message: row.message,
    relatedEntityType: row.related_entity_type ?? undefined,
    relatedEntityId: row.related_entity_id ?? undefined,
    sentAt: row.sent_at?.toISOString(),
    readAt: row.read_at?.toISOString(),
    failureReason: row.failure_reason ?? undefined,
    createdAt: row.created_at.toISOString(),
  };
}

export async function insertNotification(input: EnqueueNotificationInput): Promise<Notification> {
  const result = await query<DbNotification>(
    `INSERT INTO notifications (
        user_id, channel, type, title, message,
        related_entity_type, related_entity_id, status, next_attempt_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', NOW())
     RETURNING *`,
    [
      input.userId,
      input.channel,
      input.type,
      input.title,
      input.message,
      input.relatedEntityType ?? null,
      input.relatedEntityId ?? null,
    ],
  );
  return mapNotification(result.rows[0]);
}

export async function listByUser(userId: string, unreadOnly = false): Promise<Notification[]> {
  const rows = await queryAll<DbNotification>(
    unreadOnly
      ? `SELECT * FROM notifications WHERE user_id = $1 AND status <> 'read' ORDER BY created_at DESC`
      : `SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId],
  );
  return rows.map(mapNotification);
}

export async function markRead(id: string, userId: string): Promise<Notification | null> {
  const result = await query<DbNotification>(
    `UPDATE notifications
        SET status = 'read', read_at = COALESCE(read_at, NOW())
      WHERE id = $1 AND user_id = $2
      RETURNING *`,
    [id, userId],
  );
  return result.rows[0] ? mapNotification(result.rows[0]) : null;
}

export async function claimNotificationById(
  id: string,
): Promise<(Notification & { email: string | null; attemptCount: number }) | null> {
  const rows = await queryAll<DbNotification & { email: string | null; attempt_count: number }>(
    `UPDATE notifications n
        SET attempt_count = n.attempt_count + 1
       FROM profiles p
      WHERE n.id = $1
        AND p.id = n.user_id
        AND n.status IN ('pending', 'failed')
        AND n.attempt_count < 8
     RETURNING n.*, p.email`,
    [id],
  );
  const row = rows[0];
  if (!row) return null;
  return { ...mapNotification(row), email: row.email, attemptCount: row.attempt_count };
}

export async function claimDispatchBatch(limit = 40): Promise<
  Array<Notification & { email: string | null; attemptCount: number }>
> {
  const rows = await queryAll<DbNotification & { email: string | null; attempt_count: number }>(
    `WITH next AS (
       SELECT n.id
       FROM notifications n
       WHERE n.status IN ('pending', 'failed')
         AND (n.next_attempt_at IS NULL OR n.next_attempt_at <= NOW())
         AND n.attempt_count < 8
       ORDER BY n.created_at
       FOR UPDATE SKIP LOCKED
       LIMIT $1
     )
     UPDATE notifications n
        SET attempt_count = n.attempt_count + 1
       FROM next, profiles p
      WHERE n.id = next.id
        AND p.id = n.user_id
     RETURNING n.*, p.email`,
    [limit],
  );

  return rows.map((row) => ({
    ...mapNotification(row),
    email: row.email,
    attemptCount: row.attempt_count,
  }));
}

export async function countUnread(userId: string): Promise<number> {
  const row = await queryOne<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM notifications
      WHERE user_id = $1 AND status <> 'read'`,
    [userId],
  );
  return Number(row?.count ?? 0);
}

export async function preferredLanguage(userId: string): Promise<"en" | "am" | null> {
  return withTransaction(async (client) => {
    const row = await queryOne<{ preferred_language: "en" | "am" | null }>(
      "SELECT preferred_language FROM profiles WHERE id = $1 AND is_active = TRUE",
      [userId],
      client,
    );
    return row?.preferred_language ?? null;
  }, { userId });
}

export async function markAllRead(userId: string): Promise<number> {
  const result = await query(
    `UPDATE notifications
        SET status = 'read', read_at = COALESCE(read_at, NOW())
      WHERE user_id = $1 AND status <> 'read'`,
    [userId],
  );
  return result.rowCount ?? 0;
}

export async function markSent(id: string, providerMessageId?: string): Promise<void> {
  await query(
    `UPDATE notifications
        SET status = 'sent', sent_at = NOW(), failure_reason = NULL, provider_message_id = $2
      WHERE id = $1`,
    [id, providerMessageId ?? null],
  );
}

export async function markFailed(id: string, reason: string): Promise<void> {
  await query(
    `UPDATE notifications
        SET status = 'failed',
            failure_reason = $2,
            next_attempt_at = NOW() + LEAST(INTERVAL '15 minutes', (attempt_count * INTERVAL '30 seconds'))
      WHERE id = $1`,
    [id, reason.slice(0, 2000)],
  );
}

export async function getProfileEmail(userId: string): Promise<string | null> {
  const row = await queryOne<{ email: string }>(`SELECT email FROM profiles WHERE id = $1`, [userId]);
  return row?.email ?? null;
}
