import { query, queryAll, queryOne } from "../infrastructure/database/query.js";
import type { Queryable } from "../infrastructure/database/query.js";
import type { NotificationChannel } from "@auction/shared";

export interface WatchlistItem {
  id: string;
  userId: string;
  auctionId: string;
  notes: string | null;
  notifyOnBid: boolean;
  notifyOnStatusChange: boolean;
  notifyOnClosingSoon: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SavedSearch {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  searchCriteria: {
    categoryId?: string;
    region?: string;
    minValue?: number;
    maxValue?: number;
    keywords?: string;
    auctionType?: string;
  };
  isActive: boolean;
  notifyOnMatch: boolean;
  lastCheckedAt: Date | null;
  matchCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationPreference {
  userId: string;
  eventType: string;
  channel: 'in_app' | 'email' | 'telegram' | 'voice';
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type AlertTriggerType =
  | 'new_auction_match'
  | 'watchlist_bid'
  | 'watchlist_status_change'
  | 'watchlist_closing_soon'
  | 'price_threshold'
  | 'category_new_auction';

export interface AlertTrigger {
  id: string;
  userId: string;
  triggerType: AlertTriggerType;
  auctionId: string | null;
  savedSearchId: string | null;
  watchlistItemId: string | null;
  notificationId: string | null;
  triggerData: Record<string, unknown>;
  createdAt: Date;
}

interface DbWatchlistItem {
  id: string;
  user_id: string;
  auction_id: string;
  notes: string | null;
  notify_on_bid: boolean;
  notify_on_status_change: boolean;
  notify_on_closing_soon: boolean;
  created_at: Date;
  updated_at: Date;
}

interface DbSavedSearch {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  search_criteria: Record<string, unknown>;
  is_active: boolean;
  notify_on_match: boolean;
  last_checked_at: Date | null;
  match_count: number;
  created_at: Date;
  updated_at: Date;
}

interface DbNotificationPreference {
  user_id: string;
  event_type: string;
  channel: string;
  enabled: boolean;
  created_at: Date;
  updated_at: Date;
}

interface DbAlertTrigger {
  id: string;
  user_id: string;
  trigger_type: AlertTriggerType;
  auction_id: string | null;
  saved_search_id: string | null;
  watchlist_item_id: string | null;
  notification_id: string | null;
  trigger_data: Record<string, unknown>;
  created_at: Date;
}

function mapWatchlistItem(row: DbWatchlistItem): WatchlistItem {
  return {
    id: row.id,
    userId: row.user_id,
    auctionId: row.auction_id,
    notes: row.notes,
    notifyOnBid: row.notify_on_bid,
    notifyOnStatusChange: row.notify_on_status_change,
    notifyOnClosingSoon: row.notify_on_closing_soon,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSavedSearch(row: DbSavedSearch): SavedSearch {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    description: row.description,
    searchCriteria: row.search_criteria as any,
    isActive: row.is_active,
    notifyOnMatch: row.notify_on_match,
    lastCheckedAt: row.last_checked_at,
    matchCount: row.match_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapNotificationPreference(row: DbNotificationPreference): NotificationPreference {
  return {
    userId: row.user_id,
    eventType: row.event_type,
    channel: row.channel as any,
    enabled: row.enabled,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAlertTrigger(row: DbAlertTrigger): AlertTrigger {
  return {
    id: row.id,
    userId: row.user_id,
    triggerType: row.trigger_type,
    auctionId: row.auction_id,
    savedSearchId: row.saved_search_id,
    watchlistItemId: row.watchlist_item_id,
    notificationId: row.notification_id,
    triggerData: row.trigger_data,
    createdAt: row.created_at,
  };
}

// ========================================================================
// Watchlist Operations
// ========================================================================

export async function addToWatchlist(
  input: {
    userId: string;
    auctionId: string;
    notes?: string;
    notifyOnBid?: boolean;
    notifyOnStatusChange?: boolean;
    notifyOnClosingSoon?: boolean;
  },
  client?: Queryable,
): Promise<WatchlistItem> {
  const result = await query<DbWatchlistItem>(
    `INSERT INTO watchlist_items (
      user_id, auction_id, notes, notify_on_bid, notify_on_status_change, notify_on_closing_soon
    ) VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (user_id, auction_id) DO UPDATE SET
      notes = EXCLUDED.notes,
      notify_on_bid = EXCLUDED.notify_on_bid,
      notify_on_status_change = EXCLUDED.notify_on_status_change,
      notify_on_closing_soon = EXCLUDED.notify_on_closing_soon,
      updated_at = NOW()
    RETURNING *`,
    [
      input.userId,
      input.auctionId,
      input.notes ?? null,
      input.notifyOnBid ?? true,
      input.notifyOnStatusChange ?? true,
      input.notifyOnClosingSoon ?? true,
    ],
    client,
  );
  return mapWatchlistItem(result.rows[0]);
}

export async function removeFromWatchlist(
  userId: string,
  auctionId: string,
  client?: Queryable,
): Promise<boolean> {
  const result = await query(
    `DELETE FROM watchlist_items WHERE user_id = $1 AND auction_id = $2`,
    [userId, auctionId],
    client,
  );
  return (result.rowCount ?? 0) > 0;
}

export async function getUserWatchlist(
  userId: string,
  limit: number = 50,
  offset: number = 0,
  client?: Queryable,
): Promise<WatchlistItem[]> {
  const rows = await queryAll<DbWatchlistItem>(
    `SELECT * FROM watchlist_items
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset],
    client,
  );
  return rows.map(mapWatchlistItem);
}

export async function countUserWatchlist(
  userId: string,
  client?: Queryable,
): Promise<number> {
  const row = await queryOne<{ total: string }>(
    `SELECT count(*)::text AS total FROM watchlist_items WHERE user_id = $1`,
    [userId],
    client,
  );
  return Number(row?.total ?? 0);
}

export async function getWatchlistItem(
  userId: string,
  auctionId: string,
  client?: Queryable,
): Promise<WatchlistItem | null> {
  const row = await queryOne<DbWatchlistItem>(
    `SELECT * FROM watchlist_items WHERE user_id = $1 AND auction_id = $2`,
    [userId, auctionId],
    client,
  );
  return row ? mapWatchlistItem(row) : null;
}

export async function isWatching(
  userId: string,
  auctionId: string,
  client?: Queryable,
): Promise<boolean> {
  const row = await queryOne<{ exists: boolean }>(
    `SELECT EXISTS(SELECT 1 FROM watchlist_items WHERE user_id = $1 AND auction_id = $2) as exists`,
    [userId, auctionId],
    client,
  );
  return row?.exists ?? false;
}

// ========================================================================
// Saved Searches Operations
// ========================================================================

export async function createSavedSearch(
  input: {
    userId: string;
    name: string;
    description?: string;
    searchCriteria: Record<string, unknown>;
    notifyOnMatch?: boolean;
  },
  client?: Queryable,
): Promise<SavedSearch> {
  const result = await query<DbSavedSearch>(
    `INSERT INTO saved_searches (
      user_id, name, description, search_criteria, notify_on_match
    ) VALUES ($1, $2, $3, $4::jsonb, $5)
    RETURNING *`,
    [
      input.userId,
      input.name,
      input.description ?? null,
      JSON.stringify(input.searchCriteria),
      input.notifyOnMatch ?? true,
    ],
    client,
  );
  return mapSavedSearch(result.rows[0]);
}

export async function updateSavedSearch(
  id: string,
  userId: string,
  updates: {
    name?: string;
    description?: string;
    searchCriteria?: Record<string, unknown>;
    isActive?: boolean;
    notifyOnMatch?: boolean;
  },
  client?: Queryable,
): Promise<SavedSearch | null> {
  const setClauses: string[] = [];
  const values: unknown[] = [id, userId];
  let paramCount = 2;

  if (updates.name !== undefined) {
    paramCount++;
    setClauses.push(`name = $${paramCount}`);
    values.push(updates.name);
  }

  if (updates.description !== undefined) {
    paramCount++;
    setClauses.push(`description = $${paramCount}`);
    values.push(updates.description);
  }

  if (updates.searchCriteria !== undefined) {
    paramCount++;
    setClauses.push(`search_criteria = $${paramCount}::jsonb`);
    values.push(JSON.stringify(updates.searchCriteria));
  }

  if (updates.isActive !== undefined) {
    paramCount++;
    setClauses.push(`is_active = $${paramCount}`);
    values.push(updates.isActive);
  }

  if (updates.notifyOnMatch !== undefined) {
    paramCount++;
    setClauses.push(`notify_on_match = $${paramCount}`);
    values.push(updates.notifyOnMatch);
  }

  if (setClauses.length === 0) return null;

  setClauses.push('updated_at = NOW()');

  const result = await query<DbSavedSearch>(
    `UPDATE saved_searches SET ${setClauses.join(', ')}
     WHERE id = $1 AND user_id = $2
     RETURNING *`,
    values,
    client,
  );

  return result.rows[0] ? mapSavedSearch(result.rows[0]) : null;
}

export async function deleteSavedSearch(
  id: string,
  userId: string,
  client?: Queryable,
): Promise<boolean> {
  const result = await query(
    `DELETE FROM saved_searches WHERE id = $1 AND user_id = $2`,
    [id, userId],
    client,
  );
  return (result.rowCount ?? 0) > 0;
}

export async function getUserSavedSearches(
  userId: string,
  client?: Queryable,
): Promise<SavedSearch[]> {
  const rows = await queryAll<DbSavedSearch>(
    `SELECT * FROM saved_searches
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId],
    client,
  );
  return rows.map(mapSavedSearch);
}

export async function getActiveSavedSearches(client?: Queryable): Promise<SavedSearch[]> {
  const rows = await queryAll<DbSavedSearch>(
    `SELECT * FROM saved_searches
     WHERE is_active = true AND notify_on_match = true`,
    [],
    client,
  );
  return rows.map(mapSavedSearch);
}

export async function updateSearchLastChecked(
  id: string,
  matchCount: number,
  client?: Queryable,
): Promise<void> {
  await query(
    `UPDATE saved_searches
     SET last_checked_at = NOW(), match_count = match_count + $2
     WHERE id = $1`,
    [id, matchCount],
    client,
  );
}

// ========================================================================
// Notification Preferences Operations
// ========================================================================

export async function setNotificationPreference(
  input: {
    userId: string;
    eventType: string;
    channel: 'in_app' | 'email' | 'telegram' | 'voice';
    enabled: boolean;
  },
  client?: Queryable,
): Promise<NotificationPreference> {
  const result = await query<DbNotificationPreference>(
    `INSERT INTO notification_preferences (user_id, event_type, channel, enabled)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, event_type, channel) DO UPDATE SET
       enabled = EXCLUDED.enabled,
       updated_at = NOW()
     RETURNING *`,
    [input.userId, input.eventType, input.channel, input.enabled],
    client,
  );
  return mapNotificationPreference(result.rows[0]);
}

export async function getUserPreferences(
  userId: string,
  client?: Queryable,
): Promise<NotificationPreference[]> {
  const rows = await queryAll<DbNotificationPreference>(
    `SELECT * FROM notification_preferences WHERE user_id = $1`,
    [userId],
    client,
  );
  return rows.map(mapNotificationPreference);
}

export async function getPreferredChannels(
  userId: string,
  eventType: string,
  client?: Queryable,
): Promise<Array<'in_app' | 'email' | 'telegram' | 'voice'>> {
  const rows = await queryAll<{ channel: string }>(
    `SELECT channel FROM notification_preferences
     WHERE user_id = $1 AND event_type = $2 AND enabled = true`,
    [userId, eventType],
    client,
  );
  return rows.map((r) => r.channel as any);
}

// ========================================================================
// Alert Triggers Operations
// ========================================================================

export async function createAlertTrigger(
  input: {
    userId: string;
    triggerType: AlertTriggerType;
    auctionId?: string;
    savedSearchId?: string;
    watchlistItemId?: string;
    notificationId?: string;
    triggerData?: Record<string, unknown>;
  },
  client?: Queryable,
): Promise<AlertTrigger> {
  const result = await query<DbAlertTrigger>(
    `INSERT INTO alert_triggers (
      user_id, trigger_type, auction_id, saved_search_id, watchlist_item_id,
      notification_id, trigger_data
    ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
    RETURNING *`,
    [
      input.userId,
      input.triggerType,
      input.auctionId ?? null,
      input.savedSearchId ?? null,
      input.watchlistItemId ?? null,
      input.notificationId ?? null,
      JSON.stringify(input.triggerData ?? {}),
    ],
    client,
  );
  return mapAlertTrigger(result.rows[0]);
}

export async function getRecentAlertTriggers(
  userId: string,
  limit: number = 50,
  client?: Queryable,
): Promise<AlertTrigger[]> {
  const rows = await queryAll<DbAlertTrigger>(
    `SELECT * FROM alert_triggers
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [userId, limit],
    client,
  );
  return rows.map(mapAlertTrigger);
}

export async function checkDuplicateAlert(
  userId: string,
  triggerType: AlertTriggerType,
  auctionId: string,
  hoursWindow: number = 24,
  client?: Queryable,
): Promise<boolean> {
  const row = await queryOne<{ exists: boolean }>(
    `SELECT EXISTS(
      SELECT 1 FROM alert_triggers
      WHERE user_id = $1
        AND trigger_type = $2
        AND auction_id = $3
        AND created_at >= NOW() - ($4::INT * INTERVAL '1 hour')
    ) as exists`,
    [userId, triggerType, auctionId, hoursWindow],
    client,
  );
  return row?.exists ?? false;
}

export interface WatchlistRecord {
  auctionId: string;
  auctionTitle: string;
  auctionStatus: string;
  channel: NotificationChannel;
  alertOnBids: boolean;
  alertOnStatus: boolean;
  createdAt: string;
}

export interface Watcher {
  userId: string;
  channel: NotificationChannel;
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
  return queryOne<{ title: string; status: string }>(
    "SELECT title, status FROM auctions WHERE id = $1",
    [auctionId],
  );
}

export async function isTelegramLinked(userId: string): Promise<boolean> {
  const row = await queryOne<{ linked: boolean }>(
    "SELECT EXISTS (SELECT 1 FROM profiles WHERE id = $1 AND telegram_id IS NOT NULL) AS linked",
    [userId],
  );
  return Boolean(row?.linked);
}

export async function countUserAuctions(userId: string): Promise<number> {
  const row = await queryOne<{ count: string }>(
    "SELECT COUNT(DISTINCT auction_id)::text AS count FROM auction_watchlists WHERE user_id = $1",
    [userId],
  );
  return Number(row?.count ?? 0);
}

export async function countAuctionUsers(auctionId: string): Promise<number> {
  const row = await queryOne<{ count: string }>(
    "SELECT COUNT(DISTINCT user_id)::text AS count FROM auction_watchlists WHERE auction_id = $1",
    [auctionId],
  );
  return Number(row?.count ?? 0);
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
  const row = await queryOne<{ outbox_id: string }>(
    `INSERT INTO auction_watchlist_deliveries (outbox_id, user_id, channel)
     VALUES ($1, $2, $3) ON CONFLICT DO NOTHING RETURNING outbox_id`,
    [outboxId, watcher.userId, watcher.channel],
  );
  return row !== null;
}

export interface ClosingSoonWatcher extends Watcher {
  auctionId: string;
  auctionTitle: string;
  closesAt: Date;
}

export async function getClosingSoonWatchers(): Promise<ClosingSoonWatcher[]> {
  return queryAll<ClosingSoonWatcher>(
    `SELECT w.user_id AS "userId", w.channel, w.auction_id AS "auctionId",
            a.title AS "auctionTitle", a.closes_at AS "closesAt"
       FROM auction_watchlists w
       JOIN auctions a ON a.id = w.auction_id
      WHERE w.alert_on_status
        AND a.status IN ('scheduled', 'live')
        AND a.closes_at > NOW()
        AND a.closes_at <= NOW() + INTERVAL '24 hours'
      ORDER BY a.closes_at, w.user_id, w.channel`,
  );
}
