import type { NotificationChannel } from "@auction/shared";
import { withTransaction } from "../infrastructure/database/tx.js";
import { queryOne } from "../infrastructure/database/query.js";
import { AppError } from "../shared/errors/index.js";
import * as notifications from "../notification/notification.service.js";
import * as repo from "./watchlist.repository.js";

const CHANNELS = new Set<NotificationChannel>(["in_app", "email", "telegram"]);
const STATUS_ALERTS = new Map<string, { title: string; message: (auction: string) => string }>([
  ["auction.approved", { title: "Auction scheduled", message: (name) => `"${name}" is scheduled and available to follow.` }],
  ["auction.opened", { title: "Auction is open", message: (name) => `Bidding is now open on "${name}".` }],
  ["auction.closed", { title: "Auction bidding closed", message: (name) => `Bidding has closed on "${name}". The outcome may still be under review.` }],
  ["auction.under_review", { title: "Auction under review", message: (name) => `The outcome for "${name}" is under review.` }],
  ["auction.awarded", { title: "Auction awarded", message: (name) => `The outcome for "${name}" has been awarded.` }],
  ["auction.cancelled", { title: "Auction cancelled", message: (name) => `"${name}" was cancelled.` }],
]);

export async function listWatchlists(userId: string) {
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
  if (!channels.length || channels.some((channel) => !CHANNELS.has(channel))) {
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
    if (await repo.countUserAuctions(input.userId) >= 100) {
      const existing = (await repo.listByUser(input.userId)).some((row) => row.auctionId === input.auctionId);
      if (!existing) throw AppError.unprocessable("A watchlist can contain at most 100 auctions");
    }
    if (await repo.countAuctionUsers(input.auctionId) >= 500) {
      const existing = (await repo.listByUser(input.userId)).some((row) => row.auctionId === input.auctionId);
      if (!existing) throw AppError.unprocessable("This auction has reached its watchlist capacity");
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
    const newWatchers = [];
    for (const watcher of watchers) {
      if (await repo.claimDelivery(outboxId, watcher)) newWatchers.push(watcher);
    }
    const message = isBid
      ? `New bid activity was recorded on "${auction.title}". Open the auction to review eligible activity.`
      : statusAlert!.message(auction.title);
    const title = isBid ? "New bid activity" : statusAlert!.title;

    await notifications.notifyMany(newWatchers.map((watcher) => ({
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
