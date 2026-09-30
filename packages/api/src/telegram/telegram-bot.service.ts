import { Telegraf, Markup } from "telegraf";
import { message } from "telegraf/filters";
import { env } from "../config/env.js";
import { logger } from "../shared/utils/logger.js";
import * as auctionRepo from "../auction/auction.repository.js";
import * as biddingRepo from "../bidding/bidding.repository.js";
import * as biddingService from "../bidding/bidding.service.js";
import * as auditService from "../audit/audit.service.js";
import * as aiAssistant from "../ai/assistant.service.js";
import * as telegramRepo from "./telegram.repository.js";
import { downloadTelegramAudio, processVoiceNote } from "./telegram-voice.service.js";
import type { TelegramNotificationPayload } from "./telegram.types.js";

function formatMoney(amount: string | number | null | undefined): string {
  if (amount === null || amount === undefined) return "0.00";
  const num = Number(amount);
  return isNaN(num) ? String(amount) : num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export class TelegramBotService {
  private bot: Telegraf | null = null;
  private isPolling = false;

  constructor() {
    if (env.TELEGRAM_BOT_TOKEN) {
      this.bot = new Telegraf(env.TELEGRAM_BOT_TOKEN, {
        ...(env.TELEGRAM_API_ROOT ? { telegram: { apiRoot: env.TELEGRAM_API_ROOT } } : {}),
      });
      this.setupMiddlewareAndCommands();
    } else {
      logger.info("TELEGRAM_BOT_TOKEN not configured; Telegram bot is inactive");
    }
  }

  getBotInstance(): Telegraf | null {
    return this.bot;
  }

  private setupMiddlewareAndCommands(): void {
    if (!this.bot) return;

    // Error handling
    this.bot.catch((err, ctx) => {
      logger.error({ err, updateType: ctx.updateType }, "Telegram bot error");
      void ctx.reply("⚠️ An unexpected error occurred. Please try again.").catch(() => undefined);
    });

    // Logging & rate-limit stub
    this.bot.use(async (ctx, next) => {
      const from = ctx.from;
      logger.debug({ fromId: from?.id, username: from?.username, text: "text" in ctx.message! ? ctx.message.text : undefined }, "Telegram update received");
      await next();
    });

    // Command: /start [param]
    this.bot.start(async (ctx) => {
      const payload = ctx.payload?.trim();
      const from = ctx.from;

      if (payload) {
        if (payload.startsWith("link_")) {
          const token = payload.replace("link_", "");
          await this.handleLinkToken(ctx, token);
          return;
        }

        if (payload.startsWith("view_")) {
          const auctionId = payload.replace("view_", "");
          await this.handleViewAuction(ctx, auctionId);
          return;
        }

        if (payload.startsWith("verify_")) {
          const auctionId = payload.replace("verify_", "");
          await this.handleVerifyAuction(ctx, auctionId);
          return;
        }
      }

      // Plain start
      const profile = await telegramRepo.findProfileByTelegramId(from.id);
      const linkedNotice = profile
        ? `✅ <b>Account Linked:</b> ${escapeHtml(profile.fullName)} (${profile.verificationStatus})`
        : `⚠️ <i>Your Telegram account is not yet connected to a portal profile. Use /link &lt;code&gt; to connect.</i>`;

      const welcome = [
        `🏛️ <b>Ethiopian Transparent Auction System</b>`,
        `Welcome to the official auction bidding, discovery & audit bot.`,
        ``,
        linkedNotice,
        ``,
        `📋 <b>Available Commands:</b>`,
        `• /auctions - Browse live & upcoming auctions`,
        `• /view &lt;id&gt; - View auction details & required deposit`,
        `• /bid &lt;id&gt; &lt;amount&gt; - Place a verified bid`,
        `• /status - Check your active bids & standing`,
        `• /verify &lt;id&gt; - Verify cryptographic SHA-256 audit chain`,
        `• /link &lt;code&gt; - Connect your portal profile`,
        `• /help - Full command reference & voice guidance`,
        ``,
        `🎙️ <b>Voice Enabled:</b> You can send voice notes in English or Amharic (አማርኛ) to check auctions, ask questions, or place bids!`,
      ].join("\n");

      await ctx.reply(welcome, {
        parse_mode: "HTML",
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback("🔍 Browse Auctions", "cmd_auctions"),
            Markup.button.callback("📊 My Status", "cmd_status"),
          ],
          [
            Markup.button.callback("🛡️ How Audit Works", "cmd_audit_info"),
            Markup.button.callback("❓ Help", "cmd_help"),
          ],
        ]),
      });
    });

    // Command: /link <code>
    this.bot.command("link", async (ctx) => {
      const parts = ctx.message.text.split(/\s+/);
      if (parts.length < 2) {
        await ctx.reply(
          "ℹ️ Please provide the 8-character connection code from your web portal profile.\n\nExample: <code>/link A7E4B29F</code>",
          { parse_mode: "HTML" },
        );
        return;
      }
      await this.handleLinkToken(ctx, parts[1]);
    });

    // Command: /auctions or /list
    this.bot.command(["auctions", "list"], async (ctx) => {
      await this.handleListAuctions(ctx);
    });

    // Command: /view <id>
    this.bot.command("view", async (ctx) => {
      const parts = ctx.message.text.split(/\s+/);
      if (parts.length < 2) {
        await ctx.reply("ℹ️ Please specify the auction ID. Example: <code>/view &lt;auction-id&gt;</code>", { parse_mode: "HTML" });
        return;
      }
      await this.handleViewAuction(ctx, parts[1]);
    });

    // Command: /bid <id> <amount>
    this.bot.command("bid", async (ctx) => {
      const parts = ctx.message.text.split(/\s+/);
      if (parts.length < 3) {
        await ctx.reply(
          "ℹ️ Usage: <code>/bid &lt;auction-id&gt; &lt;amount&gt;</code>\nExample: <code>/bid 7b2c... 50000</code>",
          { parse_mode: "HTML" },
        );
        return;
      }
      await this.handlePlaceBid(ctx, parts[1], parts[2]);
    });

    // Command: /status
    this.bot.command("status", async (ctx) => {
      await this.handleStatus(ctx);
    });

    // Command: /verify <id>
    this.bot.command("verify", async (ctx) => {
      const parts = ctx.message.text.split(/\s+/);
      if (parts.length < 2) {
        await ctx.reply("ℹ️ Usage: <code>/verify &lt;auction-id&gt;</code>", { parse_mode: "HTML" });
        return;
      }
      await this.handleVerifyAuction(ctx, parts[1]);
    });

    // Command: /help
    this.bot.command("help", async (ctx) => {
      await this.handleHelp(ctx);
    });

    // Callback queries from inline buttons
    this.bot.action("cmd_auctions", async (ctx) => {
      await ctx.answerCbQuery();
      await this.handleListAuctions(ctx);
    });

    this.bot.action("cmd_status", async (ctx) => {
      await ctx.answerCbQuery();
      await this.handleStatus(ctx);
    });

    this.bot.action("cmd_help", async (ctx) => {
      await ctx.answerCbQuery();
      await this.handleHelp(ctx);
    });

    this.bot.action("cmd_audit_info", async (ctx) => {
      await ctx.answerCbQuery();
      const info = [
        `🛡️ <b>Cryptographic Transparency & Audit-Chain</b>`,
        ``,
        `Every auction action (creation, bid placement, anti-snipe extension, deposit verification, award) is hashed into an immutable SHA-256 Merkle chain.`,
        ``,
        `• <b>Zero Tampering:</b> Any retrofitted change breaks the hash chain instantly.`,
        `• <b>Public Verifiability:</b> Anyone can audit any auction at any time via <code>/verify &lt;id&gt;</code>.`,
        `• <b>Anti-Snipe Protection:</b> Bids placed in the final minutes automatically extend the countdown to protect bidders.`,
      ].join("\n");
      await ctx.reply(info, { parse_mode: "HTML" });
    });

    this.bot.action(/^view_(.+)$/, async (ctx) => {
      await ctx.answerCbQuery();
      const auctionId = ctx.match[1];
      await this.handleViewAuction(ctx, auctionId);
    });

    this.bot.action(/^verify_(.+)$/, async (ctx) => {
      await ctx.answerCbQuery();
      const auctionId = ctx.match[1];
      await this.handleVerifyAuction(ctx, auctionId);
    });

    this.bot.action(/^bidconfirm_(.+)_(.+)$/, async (ctx) => {
      await ctx.answerCbQuery();
      const [, auctionId, amount] = ctx.match;
      await this.handlePlaceBid(ctx, auctionId, amount);
    });

    this.bot.action("bidcancel", async (ctx) => {
      await ctx.answerCbQuery("Cancelled");
      await ctx.reply("❌ Bid cancelled.");
    });

    // Voice & Audio Handler
    this.bot.on([message("voice"), message("audio")], async (ctx) => {
      await this.handleVoiceMessage(ctx);
    });

    // General text messages that are not commands: pass to AI assistant
    this.bot.on(message("text"), async (ctx) => {
      const text = ctx.message.text.trim();
      if (text.startsWith("/")) return; // Unhandled command

      await ctx.sendChatAction("typing");
      try {
        const response = await aiAssistant.askAssistant(text);
        await ctx.reply(`🤖 <b>AI Advisory Assistant:</b>\n\n${escapeHtml(response.answer)}`, {
          parse_mode: "HTML",
        });
      } catch {
        await ctx.reply("ℹ️ Type /help to see all auction commands or /auctions to discover live items.");
      }
    });
  }

  // --- HANDLERS ---

  private async handleLinkToken(ctx: any, token: string): Promise<void> {
    const from = ctx.from;
    const consumed = await telegramRepo.consumeLinkToken(token);

    if (!consumed) {
      await ctx.reply(
        "❌ <b>Invalid or Expired Code</b>\nPlease generate a fresh connection code from your online auction portal profile.",
        { parse_mode: "HTML" },
      );
      return;
    }

    await telegramRepo.linkTelegramUser(consumed.userId, from.id, from.username || null, ctx.chat.id);
    const profile = await telegramRepo.findProfileByUserId(consumed.userId);

    const msg = [
      `🎉 <b>Account Linked Successfully!</b>`,
      ``,
      `👤 <b>Name:</b> ${escapeHtml(profile?.fullName || "User")}`,
      `📧 <b>Email:</b> ${escapeHtml(profile?.email || "")}`,
      `🛡️ <b>KYC Status:</b> ${profile?.verificationStatus || "unverified"}`,
      ``,
      `You can now place bids, receive real-time outbid alerts, and track your deposits directly in Telegram.`,
      `Type /auctions to view open auctions!`,
    ].join("\n");

    await ctx.reply(msg, { parse_mode: "HTML" });
  }

  private async handleListAuctions(ctx: any): Promise<void> {
    const [liveRes, upcomingRes] = await Promise.all([
      auctionRepo.listPublicAuctions({ status: "live", limit: 50, offset: 0 }),
      auctionRepo.listPublicAuctions({ status: "scheduled", limit: 50, offset: 0 }),
    ]);
    const live = liveRes.items;
    const upcoming = upcomingRes.items;

    if (live.length === 0 && upcoming.length === 0) {
      await ctx.reply("ℹ️ There are currently no active or scheduled public auctions. Check back soon!");
      return;
    }

    const cards: string[] = [];
    cards.push(`🏛️ <b>Available Public Auctions</b> (${live.length} Live, ${upcoming.length} Upcoming)\n`);

    const buttons: any[] = [];

    for (const a of live.slice(0, 5)) {
      cards.push(
        `🟢 <b>${escapeHtml(a.title)}</b>\n` +
          `• Type: ${a.auctionType}\n` +
          `• Current Bid: ETB ${formatMoney(a.currentHighestBid || a.startPrice)}\n` +
          `• CPO Deposit: ETB ${formatMoney(a.depositAmount)}\n` +
          `• Closes: ${new Date(a.closesAt).toLocaleDateString()}\n` +
          `• ID: <code>${a.id}</code>\n`,
      );
      buttons.push([
        Markup.button.callback(`👁️ View ${a.title.slice(0, 15)}...`, `view_${a.id}`),
        Markup.button.callback(`🛡️ Verify`, `verify_${a.id}`),
      ]);
    }

    if (live.length > 5) {
      cards.push(`<i>...and ${live.length - 5} more auctions on the web portal.</i>\n`);
    }

    buttons.push([Markup.button.url("🌐 Open Web Portal", env.WEB_BASE_URL)]);

    await ctx.reply(cards.join("\n"), {
      parse_mode: "HTML",
      ...Markup.inlineKeyboard(buttons),
    });
  }

  private async handleViewAuction(ctx: any, auctionId: string): Promise<void> {
    const auction = await auctionRepo.findById(auctionId);
    if (!auction) {
      await ctx.reply("❌ Auction not found.");
      return;
    }

    const from = ctx.from;
    const profile = await telegramRepo.findProfileByTelegramId(from.id);

    let depositInfo = "⚠️ <i>Link your account to check deposit status</i>";
    if (profile) {
      const hasDep = await biddingRepo.hasVerifiedDeposit(auction.id, profile.id, auction.depositAmount);
      depositInfo = hasDep
        ? `✅ <b>Deposit Verified:</b> You are eligible to place bids.`
        : `❌ <b>Deposit Not Verified:</b> Required ETB ${formatMoney(auction.depositAmount)} CPO. Upload in web portal.`;
    }

    const text = [
      `🏛️ <b>${escapeHtml(auction.title)}</b>`,
      auction.description ? `<i>${escapeHtml(auction.description)}</i>` : "",
      ``,
      `📌 <b>Status:</b> ${auction.status.toUpperCase()}`,
      `🏷 <b>Auction Type:</b> ${auction.auctionType}`,
      `💰 <b>Starting Price:</b> ETB ${formatMoney(auction.startPrice)}`,
      auction.status === "live" ? `🔥 <b>Current Highest:</b> ETB ${formatMoney(auction.currentHighestBid)} (${auction.bidCount} bids)` : "",
      `💳 <b>Required Deposit:</b> ETB ${formatMoney(auction.depositAmount)}`,
      auction.minIncrement ? `➕ <b>Min Increment:</b> ETB ${formatMoney(auction.minIncrement)}` : "",
      `⏰ <b>Closes At:</b> ${new Date(auction.closesAt).toUTCString()}`,
      ``,
      depositInfo,
      ``,
      `💡 <i>To place a bid:</i> <code>/bid ${auction.id} &lt;amount&gt;</code>`,
    ].filter(Boolean).join("\n");

    const buttons = [
      [
        Markup.button.callback("🛡️ Verify Audit Chain", `verify_${auction.id}`),
        Markup.button.url("🌐 Portal View", `${env.WEB_BASE_URL.replace(/\/$/, "")}/auctions/${auction.id}`),
      ],
    ];

    await ctx.reply(text, {
      parse_mode: "HTML",
      ...Markup.inlineKeyboard(buttons),
    });
  }

  private async handlePlaceBid(ctx: any, auctionId: string, rawAmount: string): Promise<void> {
    const from = ctx.from;
    const amount = rawAmount.replace(/[^0-9.]/g, "");

    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      await ctx.reply("❌ Please provide a valid numeric bid amount.");
      return;
    }

    const profile = await telegramRepo.findProfileByTelegramId(from.id);
    if (!profile) {
      await ctx.reply(
        "⚠️ <b>Account Link Required</b>\nYou must connect your verified portal profile before placing bids.\nLog into the portal, copy your link code, and type <code>/link &lt;code&gt;</code>.",
        { parse_mode: "HTML" },
      );
      return;
    }

    if (profile.verificationStatus !== "verified") {
      await ctx.reply(
        `⚠️ <b>KYC Verification Required</b>\nYour profile verification status is '${profile.verificationStatus}'. Only verified bidders may participate. Please submit your verification documents in the portal.`,
        { parse_mode: "HTML" },
      );
      return;
    }

    await ctx.sendChatAction("typing");

    try {
      const idempotencyKey = `tg-${from.id}-${auctionId}-${Date.now()}`;
      const result = await biddingService.placeBid({
        auctionId,
        bidderId: profile.id,
        roles: ["bidder"],
        body: { amount },
        idempotencyKey,
        ip: `telegram:${from.id}`,
      });

      const response = [
        `🎉 <b>Bid Placed Successfully!</b>`,
        ``,
        `💰 <b>Amount:</b> ETB ${formatMoney(amount)}`,
        `📈 <b>New Highest Bid:</b> ETB ${formatMoney(result.auction.currentHighestBid)}`,
        `🔢 <b>Total Bids:</b> ${result.auction.bidCount}`,
        result.auction.extended ? `⏱️ <b>Anti-Snipe Triggered:</b> Auction deadline extended!` : "",
        `⏰ <b>Closes At:</b> ${new Date(result.auction.closesAt).toUTCString()}`,
        ``,
        `🛡️ <b>Audit Chain Event:</b>`,
        `• Sequence: #${result.audit.sequenceNo}`,
        `• Cryptographic Hash: <code>${result.audit.hash}</code>`,
      ].filter(Boolean).join("\n");

      await ctx.reply(response, {
        parse_mode: "HTML",
        ...Markup.inlineKeyboard([
          [Markup.button.callback("🛡️ Verify Audit Proof", `verify_${auctionId}`)],
        ]),
      });
    } catch (error: any) {
      logger.warn({ err: error, fromId: from.id, auctionId }, "Telegram bid placement failed");
      const msg = error.message || "Failed to place bid.";
      await ctx.reply(`❌ <b>Bid Failed:</b> ${escapeHtml(msg)}`, { parse_mode: "HTML" });
    }
  }

  private async handleStatus(ctx: any): Promise<void> {
    const from = ctx.from;
    const profile = await telegramRepo.findProfileByTelegramId(from.id);

    if (!profile) {
      await ctx.reply(
        "⚠️ You have not connected your portal account yet. Use <code>/link &lt;code&gt;</code> to connect.",
        { parse_mode: "HTML" },
      );
      return;
    }

    const text = [
      `👤 <b>Participant Standing</b>`,
      `• <b>Name:</b> ${escapeHtml(profile.fullName)}`,
      `• <b>Email:</b> ${escapeHtml(profile.email)}`,
      `• <b>KYC Status:</b> ${profile.verificationStatus}`,
      `• <b>Telegram ID:</b> <code>${profile.telegramId}</code>`,
      `• <b>Linked Since:</b> ${profile.telegramLinkedAt ? new Date(profile.telegramLinkedAt).toLocaleDateString() : "Active"}`,
      ``,
      `🔔 <i>Outbid alerts and auction result notices are automatically delivered to this chat.</i>`,
    ].join("\n");

    await ctx.reply(text, {
      parse_mode: "HTML",
      ...Markup.inlineKeyboard([
        [Markup.button.callback("🔍 Browse Live Auctions", "cmd_auctions")],
      ]),
    });
  }

  private async handleVerifyAuction(ctx: any, auctionId: string): Promise<void> {
    await ctx.sendChatAction("typing");

    const auction = await auctionRepo.findById(auctionId);
    if (!auction) {
      await ctx.reply("❌ Auction not found.");
      return;
    }

    const verification = await auditService.verifyAuditChain(auctionId);

    const text = [
      `🛡️ <b>Cryptographic Audit Chain Verification</b>`,
      ``,
      `🏛️ <b>Auction:</b> ${escapeHtml(auction.title)}`,
      `🆔 <b>ID:</b> <code>${auction.id}</code>`,
      ``,
      verification.intact
        ? `✅ <b>Chain Status: INTACT & UNBROKEN</b>\nZero tampering detected across the entire event ledger.`
        : `❌ <b>Chain Status: TAMPER DETECTED</b>\nDiscrepancy found at event sequence #${verification.brokenAtSequence}: ${escapeHtml(verification.error || "")}`,
      ``,
      `📊 <b>Total Audit Events:</b> ${verification.eventCount}`,
      verification.headHash ? `🔗 <b>Head Merkle Hash:</b>\n<code>${verification.headHash}</code>` : "",
      ``,
      `⚖️ <i>Each bid, deposit, and status transition is cryptographically chained via SHA-256 for public accountability.</i>`,
    ].filter(Boolean).join("\n");

    await ctx.reply(text, { parse_mode: "HTML" });
  }

  private async handleHelp(ctx: any): Promise<void> {
    const help = [
      `📖 <b>Auction Bot Guide & Commands</b>`,
      ``,
      `<b>Core Commands:</b>`,
      `• <code>/auctions</code> - List live and upcoming public auctions`,
      `• <code>/view &lt;auctionId&gt;</code> - View full auction details and deposit requirement`,
      `• <code>/bid &lt;auctionId&gt; &lt;amount&gt;</code> - Place a live bid (requires linked account & CPO deposit)`,
      `• <code>/status</code> - View your linked profile, standing & notifications`,
      `• <code>/verify &lt;auctionId&gt;</code> - Verify the cryptographic SHA-256 audit ledger`,
      `• <code>/link &lt;code&gt;</code> - Connect with your portal account`,
      ``,
      `🎙️ <b>Voice Commands & Audio Notes:</b>`,
      `Simply record and send a voice message in English or Amharic! Examples:`,
      `• <i>"Show me live vehicle auctions"</i>`,
      `• <i>"What is the current highest bid on auction 3?"</i>`,
      `• <i>"Bid 150000 birr on auction 7b2c"</i>`,
      `• <i>"የቀጥታ ጨረታዎችን አሳየኝ"</i> (Amharic audio)`,
      ``,
      `🛡️ <b>Anti-Snipe & Fairness:</b>`,
      `Bids placed in the final minutes automatically extend the countdown by 2 minutes to prevent sniping.`,
    ].join("\n");

    await ctx.reply(help, { parse_mode: "HTML" });
  }

  private async handleVoiceMessage(ctx: any): Promise<void> {
    await ctx.sendChatAction("typing");
    const voice = ctx.message.voice || ctx.message.audio;
    if (!voice) return;

    try {
      const fileLink = await ctx.telegram.getFileLink(voice.file_id);
      const audioBuffer = await downloadTelegramAudio(fileLink.href);

      await ctx.reply("🎧 <i>Transcribing and analyzing voice message...</i>", { parse_mode: "HTML" });

      const result = await processVoiceNote(audioBuffer, voice.mime_type || "audio/ogg");

      const header = [
        `🎙️ <b>Voice Heard:</b> "${escapeHtml(result.transcription)}"`,
        result.language === "am" && result.details ? `📝 <i>Meaning:</i> ${escapeHtml(result.details)}` : "",
      ].filter(Boolean).join("\n");

      await ctx.reply(header, { parse_mode: "HTML" });

      // Action based on intent
      if (result.intent === "bid" && result.amount && (result.auctionId || result.auctionNumber)) {
        let targetAuctionId = result.auctionId;

        // If auction number was spoken (e.g. "auction 1" or "auction 2"), resolve from live list
        if (!targetAuctionId && result.auctionNumber) {
          const live = (await auctionRepo.listPublicAuctions({ status: "live", limit: 50, offset: 0 })).items;
          const idx = Number(result.auctionNumber) - 1;
          if (idx >= 0 && idx < live.length) {
            targetAuctionId = live[idx].id;
          }
        }

        if (targetAuctionId) {
          const auction = await auctionRepo.findById(targetAuctionId);
          if (auction) {
            await ctx.reply(
              `⚠️ <b>Confirm Voice Bid</b>\n\n` +
                `• <b>Auction:</b> ${escapeHtml(auction.title)}\n` +
                `• <b>Bid Amount:</b> ETB ${formatMoney(result.amount)}\n\n` +
                `Do you want to submit this bid now?`,
              {
                parse_mode: "HTML",
                ...Markup.inlineKeyboard([
                  [
                    Markup.button.callback(`✅ Confirm ETB ${formatMoney(result.amount)}`, `bidconfirm_${auction.id}_${result.amount}`),
                    Markup.button.callback("❌ Cancel", "bidcancel"),
                  ],
                ]),
              },
            );
            return;
          }
        }
      }

      if (result.intent === "discover") {
        await this.handleListAuctions(ctx);
        return;
      }

      if (result.intent === "status") {
        await this.handleStatus(ctx);
        return;
      }

      if (result.intent === "verify" && result.auctionId) {
        await this.handleVerifyAuction(ctx, result.auctionId);
        return;
      }

      // Default or question: run through assistant
      const answer = await aiAssistant.askAssistant(result.transcription);
      await ctx.reply(`🤖 <b>AI Advisory Assistant:</b>\n\n${escapeHtml(answer.answer)}`, { parse_mode: "HTML" });
    } catch (error) {
      logger.error({ err: error }, "Failed to process Telegram voice message");
      await ctx.reply("⚠️ Could not process the voice note. Please try speaking clearly or use text commands like /auctions or /bid.");
    }
  }

  // --- OUTBOUND NOTIFICATIONS ---

  /**
   * Sends a direct notification to a linked Telegram chat (e.g. outbid alert, auction won).
   */
  async sendDirectNotification(chatId: string | number, payload: TelegramNotificationPayload): Promise<boolean> {
    if (!this.bot) return false;

    const icon = payload.type.includes("outbid")
      ? "⚠️"
      : payload.type.includes("won") || payload.type.includes("awarded")
        ? "🏆"
        : payload.type.includes("deposit")
          ? "💳"
          : "📢";

    const text = [
      `${icon} <b>${escapeHtml(payload.title)}</b>`,
      ``,
      `${escapeHtml(payload.message)}`,
    ].join("\n");

    const buttons: any[] = [];
    if (payload.relatedEntityType === "auction" && payload.relatedEntityId) {
      buttons.push([
        Markup.button.callback("👁️ View Auction", `view_${payload.relatedEntityId}`),
        Markup.button.callback("🛡️ Verify Audit", `verify_${payload.relatedEntityId}`),
      ]);
    }

    try {
      await this.bot.telegram.sendMessage(chatId, text, {
        parse_mode: "HTML",
        ...(buttons.length > 0 ? Markup.inlineKeyboard(buttons) : {}),
      });
      return true;
    } catch (error) {
      logger.error({ err: error, chatId }, "Failed to send direct Telegram notification");
      return false;
    }
  }

  // --- LIFECYCLE ---

  async start(): Promise<void> {
    if (!this.bot) return;

    if (env.TELEGRAM_WEBHOOK_URL) {
      const webhookUrl = `${env.TELEGRAM_WEBHOOK_URL.replace(/\/$/, "")}/api/v1/telegram/webhook`;
      await this.bot.telegram.setWebhook(webhookUrl, {
        secret_token: env.TELEGRAM_WEBHOOK_SECRET,
      });
      logger.info({ webhookUrl }, "Telegram webhook registered");
    } else if (env.TELEGRAM_POLLING || env.NODE_ENV === "development") {
      // Long-polling for local dev or when polling flag enabled
      // Remove any leftover webhook first
      await this.bot.telegram.deleteWebhook().catch(() => undefined);
      void this.bot.launch(() => {
        this.isPolling = true;
        logger.info("Telegram bot polling started");
      }).catch((error) => {
        this.isPolling = false;
        logger.error({ err: error }, "Telegram bot polling failed to start");
      });
    } else {
      logger.warn(
        "Telegram bot is configured but no inbound transport is enabled; set TELEGRAM_WEBHOOK_URL or TELEGRAM_POLLING=true",
      );
    }
  }

  async stop(): Promise<void> {
    if (this.bot && this.isPolling) {
      this.bot.stop("SIGTERM");
      this.isPolling = false;
      logger.info("Telegram bot polling stopped");
    }
  }
}
