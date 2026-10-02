import type { Telegraf } from "telegraf";
import { env } from "../config/env.js";
import { logger } from "../shared/utils/logger.js";
import * as auctionRepo from "../auction/auction.repository.js";
import * as telegramRepo from "./telegram.repository.js";
import type { Auction } from "../auction/auction.types.js";
import { AppError, HttpStatus } from "../shared/errors/index.js";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatMoney(amount: string | number | null | undefined): string {
  if (amount === null || amount === undefined) return "0.00";
  const num = Number(amount);
  return isNaN(num) ? String(amount) : num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatTimeRemaining(closesAt: Date | string): string {
  const diff = new Date(closesAt).getTime() - Date.now();
  if (diff <= 0) return "Closed";
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  if (days > 0) return `${days}d ${remainingHours}h remaining`;
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m remaining`;
}

interface ChannelAuctionDetails {
  organizationName: string | null;
  winnerName: string | null;
  approvedByName: string | null;
  awardedByName: string | null;
}

export function formatAuctionChannelMessage(
  auction: Auction,
  botUsername?: string,
  details: ChannelAuctionDetails = { organizationName: null, winnerName: null, approvedByName: null, awardedByName: null },
) {
  const badges: Record<string, string> = {
    scheduled: "<b>NEW AUCTION LISTING</b>",
    live: "<b>LIVE FOR BIDDING · BIDDING OPEN</b>",
    closed: "<b>BIDDING CLOSED · RESULT PENDING</b>",
    under_review: "<b>OUTCOME UNDER REVIEW</b>",
    awarded: "<b>AUCTION AWARDED</b>",
    cancelled: "<b>AUCTION CANCELLED</b>",
  };
  const typeLabel = auction.auctionType === "sealed_bid" ? "🔒 Sealed Bid Auction" : "📈 Open Ascending Auction";
  const startPrice = formatMoney(auction.startPrice);
  const highestBid = formatMoney(auction.currentHighestBid);
  const deposit = formatMoney(auction.depositAmount);
  const minIncrement = formatMoney(auction.minIncrement);
  const webUrl = `${env.WEB_BASE_URL.replace(/\/$/, "")}/auctions/${auction.id}`;
  const botUser = (botUsername || env.TELEGRAM_BOT_USERNAME || "cheretanet_bot").replace(/^@/, "");
  const botBidUrl = `https://t.me/${botUser}?start=view_${auction.id}`;
  const botVerifyUrl = `https://t.me/${botUser}?start=verify_${auction.id}`;

  const outcome = auction.status === "awarded"
    ? [
        details.winnerName ? `<b>Successful bidder:</b> ${escapeHtml(details.winnerName)}` : "<b>Successful bidder:</b> See the official award notice",
        auction.winningAmount ? `<b>Award amount:</b> ETB ${formatMoney(auction.winningAmount)}` : "",
        auction.awardedAt ? `<b>Awarded:</b> ${new Date(auction.awardedAt).toUTCString()}` : "",
        details.awardedByName ? `<b>Award decision by:</b> ${escapeHtml(details.awardedByName)}` : "",
      ]
    : auction.status === "closed"
      ? auction.auctionType === "sealed_bid" && !auction.sealedOpenedAt
        ? ["Sealed offers are awaiting formal opening. No result is published yet."]
        : [auction.winnerId ? "A provisional winner is recorded; the award decision is pending." : "No winner has been recorded."]
      : auction.status === "under_review"
        ? ["The auction outcome is under review. The final result will be posted after review."]
        : auction.status === "cancelled"
          ? [auction.cancellationReason ? `<b>Reason:</b> ${escapeHtml(auction.cancellationReason)}` : "This auction has been cancelled."]
          : [];

  const text = [
    `<b>CHERETANET · PUBLIC AUCTION NOTICE</b>`,
    badges[auction.status] ?? `<b>${escapeHtml(auction.status.toUpperCase())}</b>`,
    "",
    `<b>${escapeHtml(auction.title)}</b>`,
    auction.description ? `<i>${escapeHtml(auction.description.slice(0, 200))}${auction.description.length > 200 ? "..." : ""}</i>` : "",
    "",
    details.organizationName ? `<b>Published by:</b> ${escapeHtml(details.organizationName)}` : "",
    details.approvedByName && auction.status === "scheduled" ? `<b>Approved by:</b> ${escapeHtml(details.approvedByName)}` : "",
    `<b>Format:</b> ${typeLabel}`,
    `<b>Region:</b> ${escapeHtml(auction.region || "National")}`,
    `<b>Starting price:</b> ETB ${startPrice}`,
    auction.status === "live" && auction.auctionType !== "sealed_bid" ? `<b>Current highest bid:</b> ETB ${highestBid} (${auction.bidCount} bids)` : "",
    `<b>Required deposit:</b> ETB ${deposit}`,
    auction.minIncrement ? `<b>Minimum increment:</b> ETB ${minIncrement}` : "",
    auction.status === "scheduled" ? `<b>Opens:</b> ${new Date(auction.opensAt).toUTCString()}` : "",
    ["scheduled", "live"].includes(auction.status)
      ? `<b>Closes:</b> ${new Date(auction.closesAt).toUTCString()} · ${formatTimeRemaining(auction.closesAt)}`
      : `<b>Closed:</b> ${auction.closedAt ? new Date(auction.closedAt).toUTCString() : new Date(auction.closesAt).toUTCString()}`,
    ...outcome,
    "",
    `<i>See the auction notice for official terms and supporting records.</i>`,
  ].filter(Boolean).join("\n");

  const replyMarkup = {
    inline_keyboard: [
      [
        { text: "View auction", url: webUrl },
        ...(["scheduled", "live"].includes(auction.status) ? [{ text: "Open Telegram bot", url: botBidUrl }] : []),
      ],
      [{ text: "View audit record", url: botVerifyUrl }],
    ],
  };
  return { text, replyMarkup };
}
export class TelegramChannelService {
  constructor(private readonly getBot: () => Telegraf | null) {}

  async getConnectionStatus() {
    const channelId = env.TELEGRAM_CHANNEL_ID;
    if (!channelId) {
      return { configured: false, status: "not_configured" as const, title: null, username: null, canPost: false, error: null };
    }

    const bot = this.getBot();
    if (!bot) {
      return { configured: true, status: "bot_not_configured" as const, title: null, username: null, canPost: false, error: null };
    }

    try {
      const [chat, me] = await Promise.all([
        bot.telegram.getChat(channelId),
        bot.telegram.getMe(),
      ]);
      const membership = await bot.telegram.getChatMember(channelId, me.id);
      const canPost = membership.status === "creator" ||
        (membership.status === "administrator" && membership.can_post_messages === true);

      return {
        configured: true,
        status: canPost ? "connected" as const : "permission_required" as const,
        title: "title" in chat ? chat.title : null,
        username: "username" in chat ? chat.username ?? null : null,
        canPost,
        error: null,
      };
    } catch (error) {
      return {
        configured: true,
        status: "error" as const,
        title: null,
        username: null,
        canPost: false,
        error: error instanceof Error ? error.message : "Could not check channel access",
      };
    }
  }

  /**
   * Broadcasts or updates an auction card on the official public Telegram Channel.
   */
  async broadcastAuction(auctionId: string): Promise<boolean> {
    const channelId = env.TELEGRAM_CHANNEL_ID;
    if (!channelId) {
      throw new AppError("The platform Telegram channel is not configured", HttpStatus.SERVICE_UNAVAILABLE);
    }

    const bot = this.getBot();
    if (!bot) {
      logger.warn("Telegram bot instance not initialized; cannot broadcast to channel");
      throw new AppError("Telegram bot is not configured on this server", HttpStatus.SERVICE_UNAVAILABLE);
    }

    const auction = await auctionRepo.findById(auctionId);
    if (!auction) {
      throw new AppError("Auction not found", HttpStatus.NOT_FOUND, "AUCTION_NOT_FOUND");
    }

    // Drafts and pending approvals stay private; approved lifecycle states get a channel card.
    if (!["scheduled", "live", "closed", "under_review", "awarded", "cancelled"].includes(auction.status)) {
      throw new AppError("Only approved auctions can be published", HttpStatus.CONFLICT);
    }

    const botUsername = env.TELEGRAM_BOT_USERNAME || (await bot.telegram.getMe().then((me) => me.username).catch(() => undefined));
    const details = await telegramRepo.getChannelAuctionDetails(auctionId);
    const { text, replyMarkup } = formatAuctionChannelMessage(auction, botUsername, details ?? undefined);

    const existingPost = await telegramRepo.findChannelPost(auctionId);

    try {
      if (existingPost && existingPost.channelId === channelId) {
        // Edit existing post in channel
        await bot.telegram.editMessageText(
          channelId,
          existingPost.messageId,
          undefined,
          text,
          {
            parse_mode: "HTML",
            reply_markup: replyMarkup,
            link_preview_options: { is_disabled: true },
          },
        );
        await telegramRepo.saveChannelPost(auctionId, channelId, existingPost.messageId);
        logger.info({ auctionId, channelId, messageId: existingPost.messageId }, "Updated Telegram channel post");
        return true;
      }

      // Send fresh post to channel
      const sent = await bot.telegram.sendMessage(channelId, text, {
        parse_mode: "HTML",
        reply_markup: replyMarkup,
        link_preview_options: { is_disabled: true },
      });

      await telegramRepo.saveChannelPost(auctionId, channelId, sent.message_id);
      logger.info({ auctionId, channelId, messageId: sent.message_id }, "Broadcasted auction to Telegram channel");
      return true;
    } catch (error) {
      logger.error({ err: error, auctionId, channelId }, "Failed to broadcast auction to Telegram channel");
      const description = error instanceof Error ? error.message : "Telegram API request failed";
      throw new AppError(`Telegram could not publish to the configured channel: ${description}`, HttpStatus.SERVICE_UNAVAILABLE);
    }
  }
}
