import * as repo from "./watchlist.repository.js";
import * as auctionRepo from "../auction/auction.repository.js";
import * as notifications from "../notification/notification.service.js";
import { AppError, HttpStatus } from "../shared/errors/index.js";
import { logger } from "../shared/utils/logger.js";
import type { Role } from "@auction/shared";

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
  const items = await repo.getUserWatchlist(userId, limit, offset);

  return {
    items,
    total: items.length, // TODO: Add count query if needed for pagination
  };
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
  auction: any,
  criteria: repo.SavedSearch['searchCriteria'],
): boolean {
  if (criteria.categoryId && !auction.categoryId) return false;
  if (criteria.region && auction.region !== criteria.region) return false;
  if (criteria.auctionType && auction.auctionType !== criteria.auctionType) return false;

  // Value range check
  if (criteria.minValue || criteria.maxValue) {
    const estimatedValue = Number(auction.estimatedValue || 0);
    if (criteria.minValue && estimatedValue < criteria.minValue) return false;
    if (criteria.maxValue && estimatedValue > criteria.maxValue) return false;
  }

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

      const filters: any = {
        limit: 100,
        offset: 0,
      };

      // Apply search criteria to auction query
      if (search.searchCriteria.categoryId) {
        filters.categoryId = search.searchCriteria.categoryId;
      }
      if (search.searchCriteria.region) {
        filters.region = search.searchCriteria.region;
      }

      const { items: auctions } = await auctionRepo.listPublicAuctions(filters);

      // Filter by additional criteria
      const matches = auctions.filter((auction) => {
        // Only new auctions
        if (new Date(auction.createdAt) <= since) return false;
        return matchesSavedSearch(auction, search.searchCriteria);
      });

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
  // This would need a query to get all watchlist items with auctions closing in ~24h
  // For now, return placeholder
  logger.debug({ event: "watchlist:closing_alerts_processed" });
  return { itemsChecked: 0, alertsTriggered: 0 };
}
