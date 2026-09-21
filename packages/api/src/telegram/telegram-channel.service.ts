import type { Telegraf } from "telegraf";
import { env } from "../config/env.js";
import { logger } from "../shared/utils/logger.js";
import * as auctionRepo from "../auction/auction.repository.js";
import * as telegramRepo from "./telegram.repository.js";
import type { Auction } from "../auction/auction.types.js";

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

export function formatAuctionChannelMessage(auction: Auction, botUsername?: string) {
  const isLive = auction.status === "live";
  const isClosed = auction.status === "closed" || auction.status === "awarded";
  const statusBadge = isLive
    ? "🟢 <b>LIVE FOR BIDDING</b>"
    : isClosed
      ? "🏁 <b>AUCTION CONCLUDED</b>"
      : "⏳ <b>UPCOMING AUCTION</b>";

  const typeLabel = auction.auctionType === "sealed_bid" ? "🔒 Sealed Bid Auction" : "📈 English Ascending Auction";
  const startPrice = formatMoney(auction.startPrice);
  const highestBid = formatMoney(auction.currentHighestBid);
  const deposit = formatMoney(auction.depositAmount);
  const minIncrement = formatMoney(auction.minIncrement);
  const timeLeft = formatTimeRemaining(auction.closesAt);
  const closesFormatted = new Date(auction.closesAt).toUTCString();

  const webUrl = `${env.WEB_BASE_URL.replace(/\/$/, "")}/auctions/${auction.id}`;
  const botUser = botUsername || env.TELEGRAM_BOT_USERNAME || "auction_bot";
  const botBidUrl = `https://t.me/${botUser}?start=view_${auction.id}`;
  const botVerifyUrl = `https://t.me/${botUser}?start=verify_${auction.id}`;

  const text = [
    `📢 <b>PUBLIC AUCTION NOTICE</b>`,
    statusBadge,
    ``,
    `🏛️ <b>${escapeHtml(auction.title)}</b>`,
    auction.description ? `<i>${escapeHtml(auction.description.slice(0, 200))}${auction.description.length > 200 ? "..." : ""}</i>` : "",
    ``,
    `📌 <b>Auction Type:</b> ${typeLabel}`,
    `📍 <b>Region:</b> ${escapeHtml(auction.region || "National")}`,
    `💰 <b>Starting Price:</b> ETB ${startPrice}`,
    isLive && auction.auctionType !== "sealed_bid" ? `🔥 <b>Current Highest Bid:</b> ETB ${highestBid} (${auction.bidCount} bids)` : "",
    `💳 <b>Required CPO Deposit:</b> ETB ${deposit}`,
    auction.minIncrement ? `➕ <b>Min Increment:</b> ETB ${minIncrement}` : "",
    `⏰ <b>Closes At:</b> ${closesFormatted}`,
    `⏳ <b>Time Left:</b> <b>${timeLeft}</b>`,
    ``,
    `🛡️ <b>Audit Status:</b> Cryptographically verified & tamper-evident`,
    `⚖️ <i>Governed by Federal Public Procurement & Asset Disposal Directives</i>`,
  ]
    .filter(Boolean)
    .join("\n");

  const replyMarkup = {
    inline_keyboard: [
      [
        { text: "🌐 View on Portal", url: webUrl },
        { text: "🤖 Bid via Bot", url: botBidUrl },
      ],
      [
        { text: "🛡️ Verify Audit Chain", url: botVerifyUrl },
      ],
    ],
  };

  return { text, replyMarkup };
}

export class TelegramChannelService {
  constructor(private readonly getBot: () => Telegraf | null) {}

  /**
   * Broadcasts or updates an auction card on the official public Telegram Channel.
   */
  async broadcastAuction(auctionId: string): Promise<boolean> {
    const channelId = env.TELEGRAM_CHANNEL_ID;
    if (!channelId) {
      logger.debug("TELEGRAM_CHANNEL_ID not set; skipping channel broadcast");
      return false;
    }

    const bot = this.getBot();
    if (!bot) {
      logger.warn("Telegram bot instance not initialized; cannot broadcast to channel");
      return false;
    }

    const auction = await auctionRepo.findById(auctionId);
    if (!auction) {
      logger.warn({ auctionId }, "Cannot broadcast auction: auction not found");
      return false;
    }

    // Only broadcast scheduled, live, or closed/awarded auctions
    if (!["scheduled", "live", "closed", "awarded"].includes(auction.status)) {
      return false;
    }

    const botUsername = env.TELEGRAM_BOT_USERNAME || (await bot.telegram.getMe().then((me) => me.username).catch(() => undefined));
    const { text, replyMarkup } = formatAuctionChannelMessage(auction, botUsername);

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
      return false;
    }
  }
}
