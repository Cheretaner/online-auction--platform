import * as repo from "./watchlist.repository.js";
import * as auctionRepo from "../auction/auction.repository.js";
import * as notifications from "../notification/notification.service.js";
import { AppError, HttpStatus } from "../shared/errors/index.js";
import { logger } from "../shared/utils/logger.js";
import { withTransaction } from "../infrastructure/database/tx.js";
import { queryOne } from "../infrastructure/database/query.js";
import type { NotificationChannel, Role } from "@auction/shared";

const WATCHLIST_CHANNELS = new Set<NotificationChannel>(["in_app", "email", "telegram"]);
const STATUS_ALERTS = new Map<string, { title: string; message: (auction: string) => string }>([
  ["auction.approved", { title: "Auction scheduled", message: (name) => `"${name}" is scheduled and available to follow.` }],
  ["auction.opened", { title: "Auction is open", message: (name) => `Bidding is now open on "${name}".` }],
  ["auction.closed", { title: "Auction bidding closed", message: (name) => `Bidding has closed on "${name}". The outcome may still be under review.` }],
  ["auction.under_review", { title: "Auction under review", message: (name) => `The outcome for "${name}" is under review.` }],
  ["auction.awarded", { title: "Auction awarded", message: (name) => `The outcome for "${name}" has been awarded.` }],
  ["auction.cancelled", { title: "Auction cancelled", message: (name) => `"${name}" was cancelled.` }],
]);

export async function listWatchlists(userId: string): Promise<repo.WatchlistRecord[]> {
  return repo.listByUser(userId);
}

export async function setWatchlist(input: {
  userId: string;
  auctionId: string;
  channels: NotificationChannel[];
  alertOnBids: boolean;
  alertOnStatus: boolean;
}): Promise<void> {
  const channels = [...new Set(input.channels)];
  if (!channels.length || channels.some((channel) => !WATCHLIST_CHANNELS.has(channel))) {
    throw AppError.badRequest("Select at least one available notification channel");
  }
  if (!input.alertOnBids && !input.alertOnStatus) {
    throw AppError.badRequest("Select at least one alert type");
  }

  await withTransaction(async () => {
    await queryOne("SELECT pg_advisory_xact_lock(hashtext('watchlist-user:' || $1))", [input.userId]);
    await queryOne("SELECT pg_advisory_xact_lock(hashtext('watchlist-auction:' || $1))", [input.auctionId]);

    const auction = await repo.findAuction(input.auctionId);
    if (!auction) throw AppError.notFound("Auction not found");
    if (!["scheduled", "live"].includes(auction.status)) {
      throw AppError.unprocessable("You can follow auctions after they are scheduled and before bidding closes");
    }
    if (channels.includes("telegram") && !(await repo.isTelegramLinked(input.userId))) {
      throw AppError.unprocessable("Link Telegram in your account settings before selecting Telegram alerts");
    }
    const existing = (await repo.listByUser(input.userId)).some((item) => item.auctionId === input.auctionId);
    if (!existing && await repo.countUserAuctions(input.userId) >= 100) {
      throw AppError.unprocessable("A watchlist can contain at most 100 auctions");
    }
    if (!existing && await repo.countAuctionUsers(input.auctionId) >= 500) {
      throw AppError.unprocessable("This auction has reached its watchlist capacity");
    }

    await repo.replaceForAuction(input.userId, input.auctionId, channels, input.alertOnBids, input.alertOnStatus);
  }, { userId: input.userId });
}

export async function removeWatchlist(userId: string, auctionId: string): Promise<void> {
  await repo.removeForAuction(userId, auctionId);
}

/** Called by the outbox after the associated bid/status transaction commits. */
export async function notifyWatchers(eventType: string, payload: Record<string, unknown>, outboxId: string): Promise<void> {
  const auctionId = typeof payload.auctionId === "string" ? payload.auctionId : undefined;
  if (!auctionId) return;
  const isBid = eventType === "bid.placed";
  const statusAlert = STATUS_ALERTS.get(eventType);
  if (!isBid && !statusAlert) return;

  await withTransaction(async () => {
    const auction = await repo.findAuction(auctionId);
    if (!auction) return;
    const watchers = isBid
      ? await repo.claimBidWatchers(auctionId, typeof payload.bidderId === "string" ? payload.bidderId : "")
      : await repo.listStatusWatchers(auctionId);
    const deliveries: repo.Watcher[] = [];
    for (const watcher of watchers) {
      if (await repo.claimDelivery(outboxId, watcher)) deliveries.push(watcher);
    }

    const message = isBid
      ? `New bid activity was recorded on "${auction.title}". Open the auction to review eligible activity.`
      : statusAlert!.message(auction.title);
    const title = isBid ? "New bid activity" : statusAlert!.title;
    await notifications.notifyMany(deliveries.map((watcher) => ({
      userId: watcher.userId,
      channel: watcher.channel,
      type: `watchlist.${eventType}`,
      title,
      message,
      relatedEntityType: "auction",
      relatedEntityId: auctionId,
    })));
  });
}

export interface AddToWatchlistInput {
  userId: string;
  auctionId: string;
  notes?: string;
  notifyOnBid?: boolean;
  notifyOnStatusChange?: boolean;
  notifyOnClosingSoon?: boolean;
}

export interface CreateSavedSearchInput {
  userId: string;
  name: string;
  description?: string;
  searchCriteria: {
    categoryId?: string;
    region?: string;
    minValue?: number;
    maxValue?: number;
    keywords?: string;
    auctionType?: string;
  };
  notifyOnMatch?: boolean;
}

/**
 * Add auction to user's watchlist
 */
export async function addToWatchlist(input: AddToWatchlistInput): Promise<repo.WatchlistItem> {
  // Verify auction exists
  const auction = await auctionRepo.findById(input.auctionId);
  if (!auction) {
    throw new AppError("Auction not found", HttpStatus.NOT_FOUND);
  }

  const item = await repo.addToWatchlist(input);

  logger.info({
    event: "watchlist:added",
    userId: input.userId,
    auctionId: input.auctionId,
  });

  return item;
}

/**
 * Remove auction from user's watchlist
 */
export async function removeFromWatchlist(userId: string, auctionId: string): Promise<void> {
  const removed = await repo.removeFromWatchlist(userId, auctionId);

  if (!removed) {
    throw new AppError("Watchlist item not found", HttpStatus.NOT_FOUND);
  }

  logger.info({
    event: "watchlist:removed",
    userId,
    auctionId,
  });
}

/**
 * Get user's watchlist with auction details
 */
export async function getUserWatchlist(
  userId: string,
  limit: number = 50,
  offset: number = 0,
): Promise<{ items: repo.WatchlistItem[]; total: number }> {
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(Math.trunc(limit), 100)) : 50;
  const safeOffset = Number.isFinite(offset) ? Math.max(0, Math.trunc(offset)) : 0;
  const [items, total] = await Promise.all([
    repo.getUserWatchlist(userId, safeLimit, safeOffset),
    repo.countUserWatchlist(userId),
  ]);

  return { items, total };
}

/**
 * Create a saved search
 */
export async function createSavedSearch(input: CreateSavedSearchInput): Promise<repo.SavedSearch> {
  if (!input.name || input.name.trim().length === 0) {
    throw new AppError("Search name is required", HttpStatus.BAD_REQUEST);
  }

  const search = await repo.createSavedSearch(input);

  logger.info({
    event: "saved_search:created",
    userId: input.userId,
    searchId: search.id,
    name: input.name,
  });

  return search;
}

/**
 * Update a saved search
 */
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
): Promise<repo.SavedSearch> {
  const updated = await repo.updateSavedSearch(id, userId, updates);

  if (!updated) {
    throw new AppError("Saved search not found", HttpStatus.NOT_FOUND);
  }

  logger.info({
    event: "saved_search:updated",
    userId,
    searchId: id,
  });

  return updated;
}

/**
 * Delete a saved search
 */
export async function deleteSavedSearch(id: string, userId: string): Promise<void> {
  const deleted = await repo.deleteSavedSearch(id, userId);

  if (!deleted) {
    throw new AppError("Saved search not found", HttpStatus.NOT_FOUND);
  }

  logger.info({
    event: "saved_search:deleted",
    userId,
    searchId: id,
  });
}

/**
 * Get user's saved searches
 */
export async function getUserSavedSearches(userId: string): Promise<repo.SavedSearch[]> {
  return repo.getUserSavedSearches(userId);
}

/**
 * Set notification preference
 */
export async function setNotificationPreference(input: {
  userId: string;
  eventType: string;
  channel: 'in_app' | 'email' | 'telegram' | 'voice';
  enabled: boolean;
}): Promise<repo.NotificationPreference> {
  const pref = await repo.setNotificationPreference(input);

  logger.info({
    event: "notification_preference:set",
    userId: input.userId,
    eventType: input.eventType,
    channel: input.channel,
    enabled: input.enabled,
  });

  return pref;
}

/**
 * Get user's notification preferences
 */
export async function getUserPreferences(userId: string): Promise<repo.NotificationPreference[]> {
  return repo.getUserPreferences(userId);
}

/**
 * Check if auction matches saved search criteria
 */
function matchesSavedSearch(
  auction: Awaited<ReturnType<typeof auctionRepo.listPublicAuctions>>["items"][number],
  criteria: repo.SavedSearch['searchCriteria'],
): boolean {
  if (criteria.region && auction.region?.toLocaleLowerCase() !== criteria.region.toLocaleLowerCase()) return false;
  if (criteria.auctionType && auction.auctionType !== criteria.auctionType) return false;

  // Keyword match
  if (criteria.keywords) {
    const keywords = criteria.keywords.toLowerCase();
    const title = (auction.title || '').toLowerCase();
    const description = (auction.description || '').toLowerCase();
    if (!title.includes(keywords) && !description.includes(keywords)) return false;
  }

  return true;
}

/**
 * Process saved search alerts
 * Called by scheduled job to check for new matching auctions
 */
export async function processSavedSearchAlerts(): Promise<{
  searchesChecked: number;
  alertsTriggered: number;
}> {
  const searches = await repo.getActiveSavedSearches();

  logger.info({
    event: "saved_search:processing_started",
    searchCount: searches.length,
  });

  let alertsTriggered = 0;

  for (const search of searches) {
    try {
      // Get auctions created since last check (or last 24 hours if never checked)
      const since = search.lastCheckedAt ?? new Date(Date.now() - 24 * 60 * 60 * 1000);

      const filters: Parameters<typeof auctionRepo.listPublicAuctions>[0] = {
        limit: 100,
        offset: 0,
        createdAfter: since,
      };

      if (search.searchCriteria.categoryId) {
        filters.categoryId = search.searchCriteria.categoryId;
      }
      if (search.searchCriteria.region) {
        filters.region = search.searchCriteria.region;
      }
      if (search.searchCriteria.auctionType) {
        filters.auctionType = search.searchCriteria.auctionType as Parameters<typeof auctionRepo.listPublicAuctions>[0]["auctionType"];
      }
      if (search.searchCriteria.minValue !== undefined) {
        filters.minEstimatedValue = search.searchCriteria.minValue;
      }
      if (search.searchCriteria.maxValue !== undefined) {
        filters.maxEstimatedValue = search.searchCriteria.maxValue;
      }
      if (search.searchCriteria.keywords) filters.q = search.searchCriteria.keywords;

      const matches: Awaited<ReturnType<typeof auctionRepo.listPublicAuctions>>["items"] = [];
      let offset = 0;
      let total = Number.POSITIVE_INFINITY;
      while (offset < total) {
        const page = await auctionRepo.listPublicAuctions({ ...filters, offset });
        total = page.total;
        matches.push(...page.items.filter((auction) => matchesSavedSearch(auction, search.searchCriteria)));
        offset += page.items.length;
        if (page.items.length === 0) break;
      }

      if (matches.length > 0) {
        // Get preferred notification channels
        const channels = await repo.getPreferredChannels(search.userId, 'search.match');

        for (const auction of matches) {
          // Check for duplicate alert
          const isDuplicate = await repo.checkDuplicateAlert(
            search.userId,
            'new_auction_match',
            auction.id,
            24,
          );

          if (isDuplicate) continue;

          // Send notifications on preferred channels
          for (const channel of channels.length > 0 ? channels : (['in_app'] as const)) {
            const notification = await notifications.enqueueNotification({
              userId: search.userId,
              channel: channel as import("@auction/shared").NotificationChannel,
              type: "search.match",
              title: `New auction matches "${search.name}"`,
              message: `${auction.title} - ${auction.region || "No region"}`,
              relatedEntityType: "auction",
              relatedEntityId: auction.id,
            });

            // Log alert trigger
            await repo.createAlertTrigger({
              userId: search.userId,
              triggerType: 'new_auction_match',
              auctionId: auction.id,
              savedSearchId: search.id,
              notificationId: notification.id,
              triggerData: {
                searchName: search.name,
                auctionTitle: auction.title,
              },
            });

            alertsTriggered++;
          }
        }

        await repo.updateSearchLastChecked(search.id, matches.length);
      } else {
        await repo.updateSearchLastChecked(search.id, 0);
      }
    } catch (error) {
      logger.error({
        event: "saved_search:processing_error",
        searchId: search.id,
        error,
      });
    }
  }

  logger.info({
    event: "saved_search:processing_completed",
    searchesChecked: searches.length,
    alertsTriggered,
  });

  return {
    searchesChecked: searches.length,
    alertsTriggered,
  };
}

/**
 * Process watchlist closing soon alerts
 * Called by scheduled job to notify users of auctions closing in 24h
 */
export async function processWatchlistClosingAlerts(): Promise<{
  itemsChecked: number;
  alertsTriggered: number;
}> {
  const watchers = await repo.getClosingSoonWatchers();
  const groups = new Map<string, repo.ClosingSoonWatcher[]>();
  for (const watcher of watchers) {
    const key = `${watcher.userId}:${watcher.auctionId}`;
    groups.set(key, [...(groups.get(key) ?? []), watcher]);
  }

  let alertsTriggered = 0;
  for (const group of groups.values()) {
    const first = group[0];
    let groupAlertsTriggered = 0;
    try {
      await withTransaction(async () => {
        await queryOne(
          "SELECT pg_advisory_xact_lock(hashtext('watchlist-closing:' || $1 || ':' || $2))",
          [first.userId, first.auctionId],
        );
        if (await repo.checkDuplicateAlert(first.userId, "watchlist_closing_soon", first.auctionId, 24)) return;

        const closesAt = first.closesAt instanceof Date ? first.closesAt : new Date(first.closesAt);
        for (const watcher of group) {
          const notification = await notifications.enqueueNotification({
            userId: watcher.userId,
            channel: watcher.channel,
            type: "watchlist.auction.closing_soon",
            title: "Auction closing soon",
            message: `"${watcher.auctionTitle}" is scheduled to close at ${closesAt.toISOString()}.`,
            relatedEntityType: "auction",
            relatedEntityId: watcher.auctionId,
          });
          await repo.createAlertTrigger({
            userId: watcher.userId,
            triggerType: "watchlist_closing_soon",
            auctionId: watcher.auctionId,
            notificationId: notification.id,
            triggerData: { closesAt: closesAt.toISOString() },
          });
          groupAlertsTriggered += 1;
        }
      });
      alertsTriggered += groupAlertsTriggered;
    } catch (error) {
      logger.error({
        event: "watchlist:closing_alert_error",
        userId: first.userId,
        auctionId: first.auctionId,
        error,
      });
    }
  }

  logger.info({
    event: "watchlist:closing_alerts_processed",
    itemsChecked: watchers.length,
    alertsTriggered,
  });
  return { itemsChecked: watchers.length, alertsTriggered };
}
