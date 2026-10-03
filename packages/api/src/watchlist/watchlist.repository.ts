import type { NotificationChannel } from "@auction/shared";
import { query, queryAll } from "../infrastructure/database/query.js";

export interface WatchlistRecord {
  auctionId: string;
  auctionTitle: string;
  auctionStatus: string;
  channel: NotificationChannel;
  alertOnBids: boolean;
  alertOnStatus: boolean;
  createdAt: string;
}

export async function listByUser(userId: string): Promise<WatchlistRecord[]> {
  return queryAll<WatchlistRecord>(
    `SELECT w.auction_id AS "auctionId", a.title AS "auctionTitle", a.status AS "auctionStatus",
            w.channel, w.alert_on_bids AS "alertOnBids", w.alert_on_status AS "alertOnStatus",
            w.created_at AS "createdAt"
       FROM auction_watchlists w JOIN auctions a ON a.id = w.auction_id
      WHERE w.user_id = $1 ORDER BY w.created_at DESC, a.title, w.channel`,
    [userId],
  );
}

export async function findAuction(auctionId: string): Promise<{ title: string; status: string } | null> {
  const rows = await queryAll<{ title: string; status: string }>(
    "SELECT title, status FROM auctions WHERE id = $1",
    [auctionId],
  );
  return rows[0] ?? null;
}

export async function isTelegramLinked(userId: string): Promise<boolean> {
  const rows = await queryAll<{ linked: boolean }>(
    "SELECT EXISTS (SELECT 1 FROM profiles WHERE id = $1 AND telegram_id IS NOT NULL) AS linked",
    [userId],
  );
  return Boolean(rows[0]?.linked);
}

export async function countUserAuctions(userId: string): Promise<number> {
  const rows = await queryAll<{ count: string }>(
    "SELECT COUNT(DISTINCT auction_id)::text AS count FROM auction_watchlists WHERE user_id = $1",
    [userId],
  );
  return Number(rows[0]?.count ?? 0);
}

export async function countAuctionUsers(auctionId: string): Promise<number> {
  const rows = await queryAll<{ count: string }>(
    "SELECT COUNT(DISTINCT user_id)::text AS count FROM auction_watchlists WHERE auction_id = $1",
    [auctionId],
  );
  return Number(rows[0]?.count ?? 0);
}

export async function replaceForAuction(
  userId: string,
  auctionId: string,
  channels: NotificationChannel[],
  alertOnBids: boolean,
  alertOnStatus: boolean,
): Promise<void> {
  await query("DELETE FROM auction_watchlists WHERE user_id = $1 AND auction_id = $2", [userId, auctionId]);
  for (const channel of channels) {
    await query(
      `INSERT INTO auction_watchlists (user_id, auction_id, channel, alert_on_bids, alert_on_status)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, auctionId, channel, alertOnBids, alertOnStatus],
    );
  }
}

export async function removeForAuction(userId: string, auctionId: string): Promise<void> {
  await query("DELETE FROM auction_watchlists WHERE user_id = $1 AND auction_id = $2", [userId, auctionId]);
}

export interface Watcher {
  userId: string;
  channel: NotificationChannel;
}

export async function claimBidWatchers(auctionId: string, bidderId: string): Promise<Watcher[]> {
  return queryAll<Watcher>(
    `UPDATE auction_watchlists
        SET last_bid_alert_at = NOW(), updated_at = NOW()
      WHERE auction_id = $1 AND user_id <> $2 AND alert_on_bids
        AND (last_bid_alert_at IS NULL OR last_bid_alert_at < NOW() - INTERVAL '5 minutes')
      RETURNING user_id AS "userId", channel`,
    [auctionId, bidderId],
  );
}

export async function listStatusWatchers(auctionId: string): Promise<Watcher[]> {
  return queryAll<Watcher>(
    `SELECT user_id AS "userId", channel FROM auction_watchlists
      WHERE auction_id = $1 AND alert_on_status`,
    [auctionId],
  );
}

export async function claimDelivery(outboxId: string, watcher: Watcher): Promise<boolean> {
  const rows = await queryAll<{ outbox_id: string }>(
    `INSERT INTO auction_watchlist_deliveries (outbox_id, user_id, channel)
     VALUES ($1, $2, $3) ON CONFLICT DO NOTHING RETURNING outbox_id`,
    [outboxId, watcher.userId, watcher.channel],
  );
  return rows.length > 0;
}
