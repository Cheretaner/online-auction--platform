import { Telegraf, Markup } from "telegraf";
import { env } from "../src/config/env.js";
import { formatAuctionChannelMessage } from "../src/telegram/telegram-channel.service.js";
import type { Auction } from "../src/auction/auction.types.js";

async function main() {
  console.log("==> Initializing Telegram Connection...");
  console.log(`Bot Token: ${env.TELEGRAM_BOT_TOKEN?.slice(0, 10)}...`);
  console.log(`Channel ID: ${env.TELEGRAM_CHANNEL_ID}`);
  console.log(`Bot Username: ${env.TELEGRAM_BOT_USERNAME}`);

  if (!env.TELEGRAM_BOT_TOKEN) {
    console.error("❌ TELEGRAM_BOT_TOKEN is not configured in .env");
    process.exit(1);
  }

  const bot = new Telegraf(env.TELEGRAM_BOT_TOKEN, {
    ...(env.TELEGRAM_API_ROOT ? { telegram: { apiRoot: env.TELEGRAM_API_ROOT } } : {}),
  });

  try {
    // 1. Verify Bot Identity
    const me = await bot.telegram.getMe();
    console.log(`✅ Bot verified: @${me.username} (${me.first_name}, ID: ${me.id})`);

    // 2. Register Bot Command Menu in Telegram
    await bot.telegram.setMyCommands([
      { command: "auctions", description: "Browse live & upcoming public auctions" },
      { command: "view", description: "View auction details and required CPO deposit" },
      { command: "bid", description: "Place a verified bid (/bid <id> <amount>)" },
      { command: "status", description: "Check your active bids and KYC standing" },
      { command: "verify", description: "Verify cryptographic SHA-256 audit ledger" },
      { command: "link", description: "Connect portal account (/link <code>)" },
      { command: "help", description: "Full command list and voice guidance" },
    ]);
    console.log("✅ Bot commands registered in Telegram menu.");

    // 3. Create a realistic mock auction representing high-value federal assets
    const mockAuction: Auction = {
      id: "eth-auc-2026-0042",
      orgId: "org-ministry-transport",
      title: "Commercial Fleet Clearance: 12x Isuzu Forward Heavy Trucks",
      description: "Lot of 12 inspected commercial transport vehicles, model 2021-2023. Complete maintenance records and customs clearance provided.",
      auctionType: "open_ascending",
      status: "live",
      startPrice: "24500000",
      reservePrice: "28000000",
      minIncrement: "250000",
      currentHighestBid: "26750000",
      bidCount: 9,
      depositAmount: "500000",
      eligibilityRules: "Open to registered Ethiopian logistics firms and licensed commercial enterprises. Valid TIN and business license required.",
      region: "Addis Ababa / Kality Customs Depot",
      antiSnipeSeconds: 120,
      maxExtensions: 5,
      sealedOpenedAt: null,
      closedAt: null,
      awardedAt: null,
      cancellationReason: null,
      opensAt: new Date(Date.now() - 3600_000 * 4),
      closesAt: new Date(Date.now() + 86400_000 * 3), // 3 days remaining
      originalClosesAt: new Date(Date.now() + 86400_000 * 3),
      extensionCount: 0,
      createdBy: "admin-system",
      approvedBy: "compliance-officer",
      winnerId: null,
      winningAmount: null,
      publishedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // 4. Send rich card to the channel
    const channelId = env.TELEGRAM_CHANNEL_ID;
    if (!channelId) {
      console.warn("⚠️ TELEGRAM_CHANNEL_ID not set; skipping channel post.");
    } else {
      console.log(`==> Sending mock auction card to channel: ${channelId}...`);
      const { text, replyMarkup } = formatAuctionChannelMessage(mockAuction, me.username);

      const channelMessage = await bot.telegram.sendMessage(channelId, text, {
        parse_mode: "HTML",
        reply_markup: replyMarkup,
        link_preview_options: { is_disabled: true },
      });

      console.log(`🎉 Successfully posted mock auction to channel ${channelId}! Message ID: ${channelMessage.message_id}`);
    }

    // 5. Provide direct link for user to test the bot
    const botUrl = `https://t.me/${me.username}?start=view_${mockAuction.id}`;
    console.log("\n=======================================================");
    console.log("🚀 TELEGRAM INTEGRATION IS FULLY WORKING!");
    console.log(`• Channel Post: check ${channelId}`);
    console.log(`• Test the Bot directly: ${botUrl}`);
    console.log("• Click the link above or open the bot and type /start or /auctions");
    console.log("=======================================================\n");

  } catch (error: any) {
    console.error("❌ Telegram operation failed:", error.message || error);
    if (error.response) {
      console.error("Telegram API Error Description:", error.response.description);
      if (error.response.description?.includes("chat not found")) {
        console.error("👉 TIP: Make sure the channel ID/username is correct and the channel is public, or use the numeric ID (e.g. -100...).");
      } else if (error.response.description?.includes("bot is not a member") || error.response.description?.includes("need administrator rights")) {
        console.error("👉 TIP: Please add @cheretanet_bot as an ADMINISTRATOR with 'Post Messages' permission in the channel @cheretanet.");
      }
    }
    process.exit(1);
  }
}

void main();
