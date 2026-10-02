import crypto from "node:crypto";
import { query, queryOne } from "../infrastructure/database/query.js";
import type { Queryable } from "../infrastructure/database/query.js";
import type { TelegramChannelPost, TelegramLinkToken, TelegramUserProfile } from "./telegram.types.js";

interface DbProfileRow {
  id: string;
  email: string;
  full_name: string;
  verification_status: string;
  telegram_id: string | null;
  telegram_username: string | null;
  telegram_chat_id: string | null;
  telegram_linked_at: Date | null;
}

function mapProfileRow(row: DbProfileRow): TelegramUserProfile {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    verificationStatus: row.verification_status,
    telegramId: row.telegram_id ? String(row.telegram_id) : null,
    telegramUsername: row.telegram_username,
    telegramChatId: row.telegram_chat_id ? String(row.telegram_chat_id) : null,
    telegramLinkedAt: row.telegram_linked_at ? row.telegram_linked_at.toISOString() : null,
  };
}

export async function createLinkToken(userId: string, ttlMinutes = 15, client?: Queryable): Promise<string> {
  // Generate an 8-character uppercase alphanumeric code (e.g. "A7E4B29F")
  const token = crypto.randomBytes(4).toString("hex").toUpperCase();
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

  await query(`DELETE FROM telegram_link_tokens WHERE user_id = $1`, [userId], client);
  await query(
    `INSERT INTO telegram_link_tokens (token, user_id, expires_at) VALUES ($1, $2, $3)`,
    [token, userId, expiresAt],
    client,
  );

  return token;
}

export async function consumeLinkToken(token: string, client?: Queryable): Promise<TelegramLinkToken | null> {
  const row = await queryOne<{
    token: string;
    user_id: string;
    expires_at: Date;
    created_at: Date;
  }>(
    `DELETE FROM telegram_link_tokens
      WHERE token = $1 AND expires_at > NOW()
      RETURNING token, user_id, expires_at, created_at`,
    [token.trim().toUpperCase()],
    client,
  );

  if (!row) return null;
  return {
    token: row.token,
    userId: row.user_id,
    expiresAt: new Date(row.expires_at),
    createdAt: new Date(row.created_at),
  };
}

export async function linkTelegramUser(
  userId: string,
  telegramId: number | string,
  username: string | null,
  chatId: number | string,
  client?: Queryable,
): Promise<void> {
  await query(
    `UPDATE profiles
        SET telegram_id = $1,
            telegram_username = $2,
            telegram_chat_id = $3,
            telegram_linked_at = NOW(),
            updated_at = NOW()
      WHERE id = $4`,
    [telegramId, username ?? null, chatId, userId],
    client,
  );
}

export async function unlinkTelegramUser(userId: string, client?: Queryable): Promise<void> {
  await query(
    `UPDATE profiles
        SET telegram_id = NULL,
            telegram_username = NULL,
            telegram_chat_id = NULL,
            telegram_linked_at = NULL,
            updated_at = NOW()
      WHERE id = $1`,
    [userId],
    client,
  );
}

export async function findProfileByTelegramId(
  telegramId: number | string,
  client?: Queryable,
): Promise<TelegramUserProfile | null> {
  const row = await queryOne<DbProfileRow>(
    `SELECT id, email, full_name, verification_status, telegram_id, telegram_username, telegram_chat_id, telegram_linked_at
       FROM profiles
      WHERE telegram_id = $1 AND is_active = TRUE`,
    [telegramId],
    client,
  );
  return row ? mapProfileRow(row) : null;
}

export async function findProfileByUserId(
  userId: string,
  client?: Queryable,
): Promise<TelegramUserProfile | null> {
  const row = await queryOne<DbProfileRow>(
    `SELECT id, email, full_name, verification_status, telegram_id, telegram_username, telegram_chat_id, telegram_linked_at
       FROM profiles
      WHERE id = $1 AND is_active = TRUE`,
    [userId],
    client,
  );
  return row ? mapProfileRow(row) : null;
}

export async function findChannelPost(auctionId: string, client?: Queryable): Promise<TelegramChannelPost | null> {
  const row = await queryOne<{
    auction_id: string;
    channel_id: string;
    message_id: string | number;
    posted_at: Date;
    updated_at: Date;
  }>(
    `SELECT auction_id, channel_id, message_id, posted_at, updated_at
       FROM telegram_channel_posts
      WHERE auction_id = $1`,
    [auctionId],
    client,
  );

  if (!row) return null;
  return {
    auctionId: row.auction_id,
    channelId: row.channel_id,
    messageId: Number(row.message_id),
    postedAt: new Date(row.posted_at),
    updatedAt: new Date(row.updated_at),
  };
}

export async function getChannelAuctionDetails(auctionId: string): Promise<{
  organizationName: string | null;
  winnerName: string | null;
  approvedByName: string | null;
  awardedByName: string | null;
} | null> {
  return queryOne(
    `SELECT o.name AS organization_name,
            winner.full_name AS winner_name,
            approver.full_name AS approved_by_name,
            awarder.full_name AS awarded_by_name
       FROM auctions a
       LEFT JOIN organizations o ON o.id = a.org_id
       LEFT JOIN profiles winner ON winner.id = a.winner_id
       LEFT JOIN profiles approver ON approver.id = a.approved_by
       LEFT JOIN LATERAL (
         SELECT actor_id
           FROM audit_events
          WHERE auction_id = a.id AND action = 'auction.awarded'
          ORDER BY sequence_no DESC
          LIMIT 1
       ) award_event ON TRUE
       LEFT JOIN profiles awarder ON awarder.id = award_event.actor_id
      WHERE a.id = $1`,
    [auctionId],
  ).then((row) => row ? {
    organizationName: row.organization_name,
    winnerName: row.winner_name,
    approvedByName: row.approved_by_name,
    awardedByName: row.awarded_by_name,
  } : null);
}

export async function saveChannelPost(
  auctionId: string,
  channelId: string,
  messageId: number,
  client?: Queryable,
): Promise<void> {
  await query(
    `INSERT INTO telegram_channel_posts (auction_id, channel_id, message_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (auction_id)
     DO UPDATE SET channel_id = EXCLUDED.channel_id, message_id = EXCLUDED.message_id, updated_at = NOW()`,
    [auctionId, channelId, messageId],
    client,
  );
}

export async function pruneExpiredTokens(): Promise<number> {
  const result = await query(`DELETE FROM telegram_link_tokens WHERE expires_at <= NOW()`);
  return result.rowCount ?? 0;
}
