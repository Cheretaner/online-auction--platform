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
import { formatAiAnswerForTelegram } from "./telegram-markdown.js";
import { downloadTelegramAudio, processVoiceNote } from "./telegram-voice.service.js";
import type { TelegramLanguage, TelegramNotificationPayload, TelegramUserProfile } from "./telegram.types.js";

function telegramLanguage(ctx: any, profile?: TelegramUserProfile | null): TelegramLanguage {
  if (profile?.telegramLanguage) return profile.telegramLanguage;
  return String(ctx.from?.language_code ?? "").toLowerCase().startsWith("am") ? "am" : "en";
}

function t(language: TelegramLanguage, english: string, amharic: string): string {
  return language === "am" ? amharic : english;
}

function statusText(status: string, language: TelegramLanguage): string {
  if (language !== "am") return status.replaceAll("_", " ").toUpperCase();
  const values: Record<string, string> = {
    draft: "ረቂቅ", pending_review: "ግምገማ በመጠባበቅ ላይ", scheduled: "የታቀደ", live: "በመካሄድ ላይ",
    closed: "ተዘግቷል", under_review: "በግምገማ ላይ", awarded: "ተሸልሟል", cancelled: "ተሰርዟል",
    verified: "ተረጋግጧል", unverified: "ያልተረጋገጠ", active: "ንቁ", withdrawn: "ተነስቷል", superseded: "በሌላ ተተክቷል",
  };
  return values[status] ?? status.replaceAll("_", " ");
}

function auctionTypeText(type: string, language: TelegramLanguage): string {
  if (language !== "am") return type;
  if (type === "sealed_bid") return "የታሸገ ጨረታ";
  if (type === "open_ascending") return "የክፍት ዋጋ ጨረታ";
  return type;
}

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
  private inboundTransport: "disabled" | "starting" | "webhook" | "polling" | "error" = "disabled";
  private inboundError: string | null = null;

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

  getInboundStatus() {
    return {
      transport: this.inboundTransport,
      error: this.inboundError,
    };
  }

  private setupMiddlewareAndCommands(): void {
    if (!this.bot) return;

    // Error handling
    this.bot.catch((err, ctx) => {
      logger.error({ err, updateType: ctx.updateType }, "Telegram bot error");
      // Never turn an internal bot error into a public channel/group post.
      if (ctx.chat?.type === "private") {
        void ctx.reply("Something went wrong while processing that request. Please try again or use /help.").catch(() => undefined);
      }
    });

    // Per-account limits apply before expensive audio processing or bidding.
    this.bot.use(async (ctx, next) => {
      const from = ctx.from;
      const incomingText = ctx.message && "text" in ctx.message ? ctx.message.text : undefined;
      logger.debug({ fromId: from?.id, username: from?.username, hasText: typeof incomingText === "string" }, "Telegram update received");
      const callbackData = ctx.callbackQuery && "data" in ctx.callbackQuery ? ctx.callbackQuery.data : undefined;
      const action = ctx.chat?.type === "private" && from
        ? ctx.message && ("voice" in ctx.message || "audio" in ctx.message)
          ? "voice"
          : (typeof incomingText === "string" && /^\/bid(?:@\w+)?(?:\s|$)/i.test(incomingText)) ||
              (typeof callbackData === "string" && callbackData.startsWith("bidconfirm_"))
            ? "bid"
            : null
        : null;
      if (action && from && !await telegramRepo.consumeActionRateLimit(
        from.id,
        action,
        env.SUBMISSION_RATE_WINDOW_MS,
        env.SUBMISSION_RATE_LIMIT_MAX,
      )) {
        await ctx.reply("Too many requests. Please wait a little before sending another voice note or bid.");
        return;
      }
      await next();
    });

    // Command: /start [param]
    this.bot.start(async (ctx) => {
      if (!await this.requirePrivateChat(ctx)) return;
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
      const language = telegramLanguage(ctx, profile);
      if (language === "am") {
        const linkedAm = profile
          ? `✅ <b>መለያው ተገናኝቷል፦</b> ${escapeHtml(profile.fullName)} (${escapeHtml(statusText(profile.verificationStatus, language))})`
          : "⚠️ <i>የቴሌግራም መለያዎ ከፖርታል መለያ ጋር አልተገናኘም። ለማገናኘት /link &lt;code&gt; ይጠቀሙ።</i>";
        const welcomeAm = [
          "🏛️ <b>የኢትዮጵያ ግልጽ የጨረታ ስርዓት</b>",
          "የጨረታ ፍለጋ፣ መጫረቻና ኦዲት ቦት እንኳን ደህና መጡ።",
          "",
          linkedAm,
          "",
          "📋 <b>ትዕዛዞች፦</b>",
          "• /auctions - በመካሄድ ላይ እና የታቀዱ ጨረታዎችን ይመልከቱ",
          "• /view &lt;id&gt; - የጨረታ ዝርዝርና ተቀማጭ ይመልከቱ",
          "• /bid &lt;id&gt; &lt;amount&gt; - ዋጋ ያቅርቡ",
          "• /status - የመለያዎን ሁኔታ ይመልከቱ",
          "• /verify &lt;id&gt; - የSHA-256 ኦዲት ሰንሰለትን ያረጋግጡ",
          "• /link &lt;code&gt; - የፖርታል መለያዎን ያገናኙ",
          "• /language en|am - የቦቱን ቋንቋ ይምረጡ",
          "• /help - ተጨማሪ መመሪያ ያግኙ",
          "",
          "🎙️ የድምፅ መልዕክቶች በእንግሊዝኛና በአማርኛ ይደገፋሉ። ማንኛውም የድምፅ ጨረታ ከመላኩ በፊት ማረጋገጫ ይጠይቃል።",
        ].join("\n");
        await ctx.reply(welcomeAm, {
          parse_mode: "HTML",
          ...Markup.inlineKeyboard([
            [Markup.button.callback("🔍 ጨረታዎችን ይመልከቱ", "cmd_auctions"), Markup.button.callback("📊 የእኔ ሁኔታ", "cmd_status")],
            [Markup.button.callback("🛡️ ኦዲት እንዴት ይሰራል", "cmd_audit_info"), Markup.button.callback("❓ እገዛ", "cmd_help")],
          ]),
        });
        return;
      }
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
        `🎙️ <b>Voice notes:</b> ${env.AI_PROVIDER !== "stub" && (env.GEMINI_API_KEY || env.OPENROUTER_API_KEY) ? "English and Amharic voice notes are available; every bid requires your confirmation." : "Voice transcription is currently unavailable. Use the text commands below."}`,
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
      if (!await this.requirePrivateChat(ctx)) return;
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

    this.bot.command("language", async (ctx) => {
      if (!await this.requirePrivateChat(ctx)) return;
      const requested = ctx.message.text.trim().split(/\s+/)[1]?.toLowerCase();
      if (requested !== "en" && requested !== "am") {
        const current = await telegramRepo.findProfileByTelegramId(ctx.from.id);
        const language = telegramLanguage(ctx, current);
        await ctx.reply(t(language,
          "Choose a language with /language en or /language am.",
          "ቋንቋ ለመምረጥ /language en ወይም /language am ይጠቀሙ።",
        ));
        return;
      }
      const profile = await telegramRepo.findProfileByTelegramId(ctx.from.id);
      if (!profile) {
        await ctx.reply(t(requested,
          "Link your portal account first with /link, then use /language en or /language am. Voice-note replies follow the detected language.",
          "መጀመሪያ /link በመጠቀም የፖርታል መለያዎን ያገናኙ፤ ከዚያ /language en ወይም /language am ይጠቀሙ። የድምፅ መልሶች የተነገረውን ቋንቋ ይከተላሉ።",
        ));
        return;
      }
      await telegramRepo.setTelegramLanguage(profile.id, requested);
      await ctx.reply(t(requested, "Language saved: English.", "ቋንቋው ተቀምጧል፦ አማርኛ።"));
    });

    // Command: /auctions or /list
    this.bot.command(["auctions", "list"], async (ctx) => {
      await this.handleListAuctions(ctx);
    });

    // Command: /view <id>
    this.bot.command("view", async (ctx) => {
      if (!await this.requirePrivateChat(ctx)) return;
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
      const profile = await telegramRepo.findProfileByTelegramId(ctx.from.id);
      if (telegramLanguage(ctx, profile) === "am") {
        const infoAm = [
          "🛡️ <b>ግልጽነትና የኦዲት ሰንሰለት</b>",
          "",
          "የጨረታ ፍጠር፣ ዋጋ ማቅረብ፣ የጊዜ ማራዘም፣ ተቀማጭ ማረጋገጥና ውጤት መወሰን በSHA-256 ሰንሰለት ይመዘገባሉ።",
          "",
          "• የቀድሞ መዝገብ ሲቀየር ሰንሰለቱ ይቋረጣል።",
          "• ማንኛውም ሰው በ<code>/verify &lt;id&gt;</code> የተዘጋ ጨረታን ማረጋገጥ ይችላል።",
          "• በመጨረሻ ደቂቃዎች የሚቀርብ ዋጋ የመዝጊያ ጊዜን በራስ-ሰር ሊያራዝም ይችላል።",
        ].join("\n");
        await ctx.reply(infoAm, { parse_mode: "HTML" });
        return;
      }
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

    this.bot.action(/^bidconfirm_(.+)_([0-9]+(?:\.[0-9]+)?)(?:_(en|am))?$/, async (ctx) => {
      await ctx.answerCbQuery();
      const [, auctionId, amount, language] = ctx.match;
      await this.handlePlaceBid(ctx, auctionId, amount, language as TelegramLanguage | undefined);
    });

    this.bot.action("bidcancel", async (ctx) => {
      await ctx.answerCbQuery("Cancelled");
      await ctx.reply("❌ Bid cancelled.");
    });

    // Voice & Audio Handler
    this.bot.on([message("voice"), message("audio")], async (ctx) => {
      if (ctx.chat.type !== "private") return;
      await this.handleVoiceMessage(ctx);
    });

    // General text messages that are not commands: pass to AI assistant
    this.bot.on(message("text"), async (ctx) => {
      if (ctx.chat.type !== "private") return;
      const text = ctx.message.text.trim();
      if (text.startsWith("/")) return; // Unhandled command

      await ctx.sendChatAction("typing");
      const profile = await telegramRepo.findProfileByTelegramId(ctx.from.id);
      const language = telegramLanguage(ctx, profile);
      try {
        const response = await aiAssistant.askAssistant(text, undefined, language);
        await ctx.reply(`<b>${language === "am" ? "የAI ምክር ሰጪ" : "AI Advisory Assistant"}</b>\n\n${formatAiAnswerForTelegram(response.answer)}`, {
          parse_mode: "HTML",
        });
      } catch {
        await ctx.reply(t(language,
          "ℹ️ Type /help to see all auction commands or /auctions to discover live items.",
          "ℹ️ የጨረታ ትእዛዞችን ለማየት /help ወይም ያሉ ጨረታዎችን ለማግኘት /auctions ይጻፉ።",
        ));
      }
    });
  }

  // --- HANDLERS ---

  private async requirePrivateChat(ctx: any): Promise<boolean> {
    if (ctx.chat?.type === "private") return true;
    await ctx.reply("For account safety, please use this command in a private chat with the auction bot.");
    return false;
  }

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

  private async handleListAuctions(ctx: any, preferredLanguage?: TelegramLanguage): Promise<void> {
    const profileForLanguage = preferredLanguage ? null : await telegramRepo.findProfileByTelegramId(ctx.from.id);
    const language = preferredLanguage ?? telegramLanguage(ctx, profileForLanguage);
    const [liveRes, upcomingRes] = await Promise.all([
      auctionRepo.listPublicAuctions({ status: "live", limit: 50, offset: 0 }),
      auctionRepo.listPublicAuctions({ status: "scheduled", limit: 50, offset: 0 }),
    ]);
    const live = liveRes.items;
    const upcoming = upcomingRes.items;

    if (language === "am") {
      if (live.length === 0 && upcoming.length === 0) {
        await ctx.reply("አሁን በመካሄድ ላይ ወይም የታቀደ ይፋዊ ጨረታ የለም። በኋላ ይመልከቱ።");
        return;
      }
      const cards = [`🏛️ <b>ይፋዊ ጨረታዎች</b> (${live.length} በመካሄድ ላይ፣ ${upcoming.length} የታቀዱ)\n`];
      const buttons: any[] = [];
      for (const auction of [...live, ...upcoming].slice(0, 5)) {
        const sealed = auction.auctionType === "sealed_bid";
        const isLive = auction.status === "live";
        cards.push(
          `🟢 <b>${escapeHtml(auction.title)}</b>\n` +
          `• ሁኔታ፦ ${escapeHtml(statusText(auction.status, language))}\n` +
          `• ዓይነት፦ ${escapeHtml(auctionTypeText(auction.auctionType, language))}\n` +
          (sealed || !isLive
            ? `• ምልክታዊ መነሻ ዋጋ፦ ETB ${formatMoney(auction.startPrice)}\n`
            : `• አሁን ያለ ጨረታ፦ ETB ${formatMoney(auction.currentHighestBid || auction.startPrice)}\n`) +
          `• ተቀማጭ፦ ETB ${formatMoney(auction.depositAmount)}\n` +
          `• የመዝጊያ ቀን፦ ${new Date(auction.closesAt).toLocaleDateString()}\n` +
          `• መለያ፦ <code>${auction.id}</code>\n`,
        );
        buttons.push([
          Markup.button.callback(`👁️ ይመልከቱ ${auction.title.slice(0, 12)}…`, `view_${auction.id}`),
          Markup.button.callback("🛡️ ያረጋግጡ", `verify_${auction.id}`),
        ]);
      }
      if (live.length + upcoming.length > 5) cards.push(`<i>ተጨማሪ ${live.length + upcoming.length - 5} ጨረታዎች በድረ-ገጹ ላይ ይገኛሉ።</i>\n`);
      buttons.push([Markup.button.url("🌐 የድረ-ገጽ ፖርታል", env.WEB_BASE_URL)]);
      await ctx.reply(cards.join("\n"), { parse_mode: "HTML", ...Markup.inlineKeyboard(buttons) });
      return;
    }

    if (live.length === 0 && upcoming.length === 0) {
      await ctx.reply(t(language, "ℹ️ There are currently no active or scheduled public auctions. Check back soon.", "ℹ️ አሁን በመካሄድ ላይ ወይም የታቀደ ይፋዊ ጨረታ የለም። በኋላ ይመልከቱ።"));
      return;
    }

    const cards: string[] = [];
    cards.push(`🏛️ <b>Available Public Auctions</b> (${live.length} Live, ${upcoming.length} Upcoming)\n`);

    const buttons: any[] = [];

    for (const a of [...live, ...upcoming].slice(0, 5)) {
      const isLive = a.status === "live";
      const sealed = a.auctionType === "sealed_bid";
      cards.push(
        `🟢 <b>${escapeHtml(a.title)}</b>\n` +
          `• Status: ${a.status}\n` +
          `• Type: ${a.auctionType}\n` +
          (sealed || !isLive
            ? `• Indicative Starting Price: ETB ${formatMoney(a.startPrice)}\n`
            : `• Current Bid: ETB ${formatMoney(a.currentHighestBid || a.startPrice)}\n`) +
          `• CPO Deposit: ETB ${formatMoney(a.depositAmount)}\n` +
          `• Closes: ${new Date(a.closesAt).toLocaleDateString()}\n` +
          `• ID: <code>${a.id}</code>\n`,
      );
      buttons.push([
        Markup.button.callback(`👁️ View ${a.title.slice(0, 15)}...`, `view_${a.id}`),
        Markup.button.callback(`🛡️ Verify`, `verify_${a.id}`),
      ]);
    }

    if (live.length + upcoming.length > 5) {
      cards.push(`<i>...and ${live.length + upcoming.length - 5} more auctions on the web portal.</i>\n`);
    }

    buttons.push([Markup.button.url("🌐 Open Web Portal", env.WEB_BASE_URL)]);

    await ctx.reply(cards.join("\n"), {
      parse_mode: "HTML",
      ...Markup.inlineKeyboard(buttons),
    });
  }

  private async handleViewAuction(ctx: any, auctionId: string): Promise<void> {
    if (!await this.requirePrivateChat(ctx)) return;
    const from = ctx.from;
    const profile = await telegramRepo.findProfileByTelegramId(from.id);
    const language = telegramLanguage(ctx, profile);
    const auction = await auctionRepo.findById(auctionId);
    if (!auction) {
      await ctx.reply(t(language, "❌ Auction not found.", "❌ ጨረታው አልተገኘም።"));
      return;
    }
    if (language === "am") {
      const depositVerified = profile
        ? await biddingRepo.hasVerifiedDeposit(auction.id, profile.id, auction.depositAmount)
        : false;
      const depositAm = !profile
        ? "⚠️ <i>ተቀማጭ ለማየት የፖርታል መለያዎን ያገናኙ።</i>"
        : depositVerified
          ? "✅ <b>ተቀማጭ ተረጋግጧል፦</b> ለመጫረት ብቁ ነዎት።"
          : `❌ <b>ተቀማጭ አልተረጋገጠም፦</b> ETB ${formatMoney(auction.depositAmount)} CPO ያስፈልጋል። በፖርታሉ ያስገቡ።`;
      const sealed = auction.auctionType === "sealed_bid" && !auction.sealedOpenedAt;
      const textAm = [
        `🏛️ <b>${escapeHtml(auction.title)}</b>`,
        auction.description ? `<i>${escapeHtml(auction.description)}</i>` : "",
        "",
        `📌 <b>ሁኔታ፦</b> ${escapeHtml(statusText(auction.status, language))}`,
        `🏷️ <b>የጨረታ ዓይነት፦</b> ${escapeHtml(auctionTypeText(auction.auctionType, language))}`,
        `💰 <b>መነሻ ዋጋ፦</b> ETB ${formatMoney(auction.startPrice)}`,
        auction.status === "live" && !sealed ? `🔥 <b>ከፍተኛ ዋጋ፦</b> ETB ${formatMoney(auction.currentHighestBid)} (${auction.bidCount} ጨረታዎች)` : "",
        sealed ? "🔒 የታሸጉ ዋጋዎች እስኪከፈቱ ድረስ ሚስጥራዊ ናቸው።" : "",
        `💳 <b>የሚያስፈልግ ተቀማጭ፦</b> ETB ${formatMoney(auction.depositAmount)}`,
        auction.minIncrement ? `➕ <b>ዝቅተኛ ጭማሪ፦</b> ETB ${formatMoney(auction.minIncrement)}` : "",
        `⏰ <b>የመዝጊያ ሰዓት፦</b> ${new Date(auction.closesAt).toUTCString()}`,
        "",
        depositAm,
        "",
        `💡 <i>ለመጫረት፦</i> <code>/bid ${auction.id} &lt;amount&gt;</code>`,
      ].filter(Boolean).join("\n");
      await ctx.reply(textAm, {
        parse_mode: "HTML",
        ...Markup.inlineKeyboard([[
          Markup.button.callback("🛡️ ኦዲት ያረጋግጡ", `verify_${auction.id}`),
          Markup.button.url("🌐 በፖርታሉ ይመልከቱ", `${env.WEB_BASE_URL.replace(/\/$/, "")}/auctions/${auction.id}`),
        ]]),
      });
      return;
    }

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

  private async handlePlaceBid(ctx: any, auctionId: string, rawAmount: string, preferredLanguage?: TelegramLanguage): Promise<void> {
    if (!await this.requirePrivateChat(ctx)) return;
    const from = ctx.from;
    const profile = await telegramRepo.findProfileByTelegramId(from.id);
    const language = preferredLanguage ?? telegramLanguage(ctx, profile);
    const amount = rawAmount.replace(/[^0-9.]/g, "");

    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      await ctx.reply(t(language, "❌ Please provide a valid numeric bid amount.", "❌ እባክዎ ትክክለኛ የጨረታ መጠን ያስገቡ።"));
      return;
    }

    if (!profile) {
      await ctx.reply(
        t(language,
          "⚠️ <b>Account link required</b>\nConnect your verified portal profile before bidding. Copy the code from the portal and send <code>/link &lt;code&gt;</code>.",
          "⚠️ <b>መለያ ማገናኘት ያስፈልጋል</b>\nከመጫረትዎ በፊት የተረጋገጠውን የፖርታል መለያ ያገናኙ። ከፖርታሉ ኮዱን በመውሰድ <code>/link &lt;code&gt;</code> ይላኩ።",
        ),
        { parse_mode: "HTML" },
      );
      return;
    }

    if (profile.verificationStatus !== "verified") {
      await ctx.reply(
        t(language,
          `⚠️ <b>Identity verification required</b>\nYour status is '${profile.verificationStatus}'. Only verified bidders may participate. Submit your documents in the portal.`,
          `⚠️ <b>የማንነት ማረጋገጫ ያስፈልጋል</b>\nየማረጋገጫ ሁኔታዎ '${statusText(profile.verificationStatus, language)}' ነው። የተረጋገጡ ተጫራቾች ብቻ መሳተፍ ይችላሉ። ሰነዶችዎን በፖርታሉ ያስገቡ።`,
        ),
        { parse_mode: "HTML" },
      );
      return;
    }

    await ctx.sendChatAction("typing");

    try {
      const callbackQuery = ctx.callbackQuery as { message?: { message_id?: number; chat?: { id?: number } } } | undefined;
      const confirmationMessageId = callbackQuery?.message?.message_id;
      const idempotencyKey = confirmationMessageId
        ? `tg-confirm-${from.id}-${callbackQuery?.message?.chat?.id ?? ctx.chat?.id}-${confirmationMessageId}`
        : `tg-update-${ctx.update.update_id}`;
      const result = await biddingService.placeBid({
        auctionId,
        bidderId: profile.id,
        roles: ["bidder"],
        body: { amount },
        idempotencyKey,
        ip: `telegram:${from.id}`,
      });

      if (result.audit.sequenceNo === 0) {
        await ctx.reply(t(language,
          "This bid confirmation was already processed. No additional bid was placed.",
          "ይህ የጨረታ ማረጋገጫ ከዚህ በፊት ተከናውኗል። ተጨማሪ ጨረታ አልተላከም።",
        ));
        return;
      }

      if (language === "am") {
        const responseAm = [
          "🎉 <b>ጨረታው በተሳካ ሁኔታ ተላከ!</b>",
          "",
          `💰 <b>መጠን፦</b> ETB ${formatMoney(amount)}`,
          `📈 <b>አዲሱ ከፍተኛ ዋጋ፦</b> ETB ${formatMoney(result.auction.currentHighestBid)}`,
          `🔢 <b>ጠቅላላ ጨረታዎች፦</b> ${result.auction.bidCount}`,
          result.auction.extended ? "⏱️ የመዝጊያ ጊዜው ተራዝሟል።" : "",
          `⏰ <b>የመዝጊያ ሰዓት፦</b> ${new Date(result.auction.closesAt).toUTCString()}`,
          "",
          `🛡️ <b>የኦዲት ሰንሰለት ክስተት፦</b> #${result.audit.sequenceNo}`,
          `<code>${result.audit.hash}</code>`,
        ].filter(Boolean).join("\n");
        await ctx.reply(responseAm, { parse_mode: "HTML", ...Markup.inlineKeyboard([[Markup.button.callback("🛡️ የኦዲት ማረጋገጫ", `verify_${auctionId}`)]]) });
        return;
      }

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
      if (language === "am") {
        await ctx.reply("❌ <b>ጨረታው አልተሳካም።</b> የጨረታውን ሁኔታ፣ የማንነት ማረጋገጫዎንና ተቀማጭዎን ያረጋግጡ። እባክዎ በፖርታሉ ያረጋግጡ።", { parse_mode: "HTML" });
      } else {
        const msg = error.message || "Failed to place bid.";
        await ctx.reply(`❌ <b>Bid Failed:</b> ${escapeHtml(msg)}`, { parse_mode: "HTML" });
      }
    }
  }

  private async handleStatus(ctx: any, preferredLanguage?: TelegramLanguage): Promise<void> {
    if (!await this.requirePrivateChat(ctx)) return;
    const from = ctx.from;
    const profile = await telegramRepo.findProfileByTelegramId(from.id);
    const language = preferredLanguage ?? telegramLanguage(ctx, profile);

    if (language === "am") {
      if (!profile) {
        await ctx.reply("⚠️ የፖርታል መለያዎን ገና አላገናኙም። ለማገናኘት <code>/link &lt;code&gt;</code> ይጠቀሙ።", { parse_mode: "HTML" });
        return;
      }
      const statusAm = [
        "👤 <b>የተሳታፊ ሁኔታ</b>",
        `• <b>ስም፦</b> ${escapeHtml(profile.fullName)}`,
        `• <b>ኢሜይል፦</b> ${escapeHtml(profile.email)}`,
        `• <b>የማንነት ማረጋገጫ፦</b> ${escapeHtml(statusText(profile.verificationStatus, language))}`,
        `• <b>የቴሌግራም መለያ፦</b> <code>${profile.telegramId}</code>`,
        `• <b>የተገናኘበት ቀን፦</b> ${profile.telegramLinkedAt ? new Date(profile.telegramLinkedAt).toLocaleDateString() : "ንቁ"}`,
        "",
        "🔔 የዋጋ መብለጥና የጨረታ ውጤት ማሳወቂያዎች በራስ-ሰር ወደዚህ ውይይት ይላካሉ።",
      ].join("\n");
      await ctx.reply(statusAm, { parse_mode: "HTML", ...Markup.inlineKeyboard([[Markup.button.callback("🔍 ጨረታዎችን ይመልከቱ", "cmd_auctions")]]) });
      return;
    }

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

  private async handleVerifyAuction(ctx: any, auctionId: string, preferredLanguage?: TelegramLanguage): Promise<void> {
    await ctx.sendChatAction("typing");

    const auction = await auctionRepo.findById(auctionId);
    const profile = ctx.from ? await telegramRepo.findProfileByTelegramId(ctx.from.id) : null;
    const language = preferredLanguage ?? telegramLanguage(ctx, profile);
    if (!auction) {
      await ctx.reply(t(language, "❌ Auction not found.", "❌ ጨረታው አልተገኘም።"));
      return;
    }

    const verification = await auditService.verifyAuditChain(auctionId);

    if (language === "am") {
      const resultAm = [
        "🛡️ <b>የኦዲት ሰንሰለት ማረጋገጫ</b>",
        "",
        `🏛️ <b>ጨረታ፦</b> ${escapeHtml(auction.title)}`,
        `🆔 <b>መለያ፦</b> <code>${auction.id}</code>`,
        "",
        verification.intact
          ? "✅ <b>የሰንሰለት ሁኔታ፦ ጤናማ ነው</b>\nበኦዲት ክስተቶቹ ላይ ለውጥ አልተገኘም።"
          : `❌ <b>የሰንሰለት ሁኔታ፦ ችግር ተገኝቷል</b>\nበክስተት #${verification.brokenAtSequence} ላይ ልዩነት ተገኝቷል።`,
        "",
        `📊 <b>ጠቅላላ ክስተቶች፦</b> ${verification.eventCount}`,
        verification.headHash ? `🔗 <b>የመጨረሻ ሃሽ፦</b>\n<code>${verification.headHash}</code>` : "",
        "",
        "⚖️ ይህ ማረጋገጫ የሰንሰለቱን ታማኝነት ያሳያል፤ የጨረታ ውጤትን አይቀይርም።",
      ].filter(Boolean).join("\n");
      await ctx.reply(resultAm, { parse_mode: "HTML" });
      return;
    }

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
    const profile = ctx.from ? await telegramRepo.findProfileByTelegramId(ctx.from.id) : null;
    if (telegramLanguage(ctx, profile) === "am") {
      const helpAm = [
        "📖 <b>የጨረታ ቦት መመሪያ</b>",
        "",
        "• <code>/auctions</code> - ቀጥታና የታቀዱ ጨረታዎችን ይመልከቱ",
        "• <code>/view &lt;auctionId&gt;</code> - ዝርዝርና ተቀማጭ ይመልከቱ",
        "• <code>/bid &lt;auctionId&gt; &lt;amount&gt;</code> - የቀጥታ ጨረታ ያቅርቡ",
        "• <code>/status</code> - የመለያና የተሳታፊ ሁኔታ ይመልከቱ",
        "• <code>/verify &lt;auctionId&gt;</code> - የSHA-256 ኦዲት ሰንሰለትን ያረጋግጡ",
        "• <code>/link &lt;code&gt;</code> - የፖርታል መለያ ያገናኙ",
        "• <code>/language en|am</code> - የቦቱን ቋንቋ ይቀይሩ",
        "",
        "🎙️ የድምፅ ትዕዛዞች ጨረታ ለመላክ በግልጽ ማረጋገጫ ይጠይቃሉ። ማረጋገጫ ከመላክዎ በፊት ሂደቱን ይፈትሹ።",
        "ምሳሌ፦ <i>የቀጥታ ጨረታዎችን አሳየኝ</i>",
        "ምሳሌ፦ <i>በጨረታ 3 ላይ ከፍተኛው ዋጋ ስንት ነው?</i>",
        "ምሳሌ፦ <i>በጨረታ 7 ላይ 150000 ብር እጫረታለሁ</i>",
        "",
        "የድምፅ ጨረታ ከመላኩ በፊት ማረጋገጫ ያስፈልጋል፤ መደበኛ የመለያ፣ የማንነትና የተቀማጭ ምርመራዎች ይተገበራሉ።",
      ].join("\n");
      await ctx.reply(helpAm, { parse_mode: "HTML" });
      return;
    }
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
      `Voice support depends on the configured transcription provider. Bid actions always require an explicit confirmation and still pass the regular account, KYC, deposit and bidding checks. Examples:`,
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
    const linkedProfile = await telegramRepo.findProfileByTelegramId(ctx.from.id);
    let responseLanguage = telegramLanguage(ctx, linkedProfile);

    try {
      const fileLink = await ctx.telegram.getFileLink(voice.file_id);
      const audioBuffer = await downloadTelegramAudio(fileLink.href);

      await ctx.reply("🎧 <i>Transcribing and analyzing voice message...</i>", { parse_mode: "HTML" });

      const result = await processVoiceNote(audioBuffer, voice.mime_type || "audio/ogg");
      if (result.language === "am" || result.language === "en") responseLanguage = result.language;
      if (!result.available) {
        await ctx.reply(t(responseLanguage,
          `${result.details ?? "Voice transcription is unavailable."} Use /auctions, /status, /verify, or /bid as text commands.`,
          `${result.details ?? "የድምፅ ጽሑፍ ማድረግ አልተቻለም።"} እንደ ጽሑፍ /auctions፣ /status፣ /verify ወይም /bid ይጠቀሙ።`,
        ));
        return;
      }

      const header = [
        t(responseLanguage, `🎙️ <b>Voice heard:</b> "${escapeHtml(result.transcription)}"`, `🎙️ <b>የተሰማው ድምፅ፦</b> "${escapeHtml(result.transcription)}"`),
        result.language === "am" && result.details
          ? t(responseLanguage, `📝 <i>Meaning:</i> ${escapeHtml(result.details)}`, `📝 <i>ትርጉም፦</i> ${escapeHtml(result.details)}`)
          : "",
      ].filter(Boolean).join("\n");

      await ctx.reply(header, { parse_mode: "HTML" });

      // Action based on intent
      if (result.intent === "bid") {
        if (!result.amount || (!result.auctionId && !result.auctionNumber)) {
          await ctx.reply(t(responseLanguage,
            "I could not confidently identify both an auction and an amount. No bid was placed. Please use /bid <auction-id> <amount>.",
            "ጨረታውንና መጠኑን በእርግጠኝነት መለየት አልቻልኩም። ጨረታ አልተላከም። /bid <auction-id> <amount> ይጠቀሙ።",
          ));
          return;
        }
        const live = (await auctionRepo.listPublicAuctions({ status: "live", limit: 50, offset: 0 })).items;
        let targetAuctionId = result.auctionId;

        // If auction number was spoken (e.g. "auction 1" or "auction 2"), resolve from live list
        if (!targetAuctionId && result.auctionNumber) {
          const idx = Number(result.auctionNumber) - 1;
          if (idx >= 0 && idx < live.length) {
            targetAuctionId = live[idx].id;
          }
        }

        if (targetAuctionId) {
          const auction = live.find((candidate) => candidate.id === targetAuctionId);
          if (auction) {
            if (responseLanguage === "am") {
              const confirmAm = `⚠️ <b>የድምፅ ጨረታን ያረጋግጡ</b>\n\n• <b>ጨረታ፦</b> ${escapeHtml(auction.title)}\n• <b>የጨረታ መጠን፦</b> ETB ${formatMoney(result.amount)}\n\nይህን ጨረታ አሁን መላክ ይፈልጋሉ?`;
              await ctx.reply(confirmAm, {
                parse_mode: "HTML",
                ...Markup.inlineKeyboard([[
                  Markup.button.callback(`✅ አረጋግጥ ETB ${formatMoney(result.amount)}`, `bidconfirm_${auction.id}_${result.amount}_am`),
                  Markup.button.callback("❌ ሰርዝ", "bidcancel"),
                ]]),
              });
              return;
            }
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
        await ctx.reply(t(responseLanguage,
          "I could not match that to a live public auction. No bid was placed. Use /auctions to see current auction IDs.",
          "ከቀጥታ ይፋዊ ጨረታዎች ጋር ማዛመድ አልቻልኩም። ጨረታ አልተላከም። /auctions በመጠቀም መለያዎችን ይመልከቱ።",
        ));
        return;
      }

      if (result.intent === "discover") {
        await this.handleListAuctions(ctx, responseLanguage);
        return;
      }

      if (result.intent === "status") {
        await this.handleStatus(ctx, responseLanguage);
        return;
      }

      if (result.intent === "verify" && result.auctionId) {
        await this.handleVerifyAuction(ctx, result.auctionId, responseLanguage);
        return;
      }

      // Default or question: run through assistant
      const answer = await aiAssistant.askAssistant(result.transcription, undefined, responseLanguage);
      await ctx.reply(`<b>${responseLanguage === "am" ? "የAI ምክር ሰጪ" : "AI Advisory Assistant"}</b>\n\n${formatAiAnswerForTelegram(answer.answer)}`, { parse_mode: "HTML" });
    } catch (error) {
      logger.error({ err: error }, "Failed to process Telegram voice message");
      await ctx.reply(t(responseLanguage,
        "⚠️ Could not process the voice note. Please try speaking clearly or use text commands like /auctions or /bid.",
        "⚠️ የድምፅ መልዕክቱን ማስኬድ አልተቻለም። በግልጽ ይናገሩ ወይም /auctions እና /bid የጽሑፍ ትዕዛዞችን ይጠቀሙ።",
      ));
    }
  }

  // --- OUTBOUND NOTIFICATIONS ---

  /**
   * Sends a direct notification to a linked Telegram chat (e.g. outbid alert, auction won).
   */
  async sendDirectNotification(
    chatId: string | number,
    payload: TelegramNotificationPayload,
    language: TelegramLanguage = "en",
  ): Promise<boolean> {
    if (!this.bot) return false;

    let title = payload.title;
    let message = payload.message;
    if (language === "am" && payload.type.startsWith("watchlist.")) {
      const auctionName = payload.message.match(/\"([^\"]+)\"/)?.[1] ?? "";
      const localized: Record<string, { title: string; message: string }> = {
        "watchlist.bid.placed": {
          title: "አዲስ የጨረታ እንቅስቃሴ",
          message: `በ“${auctionName}” ላይ አዲስ የጨረታ እንቅስቃሴ ተመዝግቧል። ብቁ እንቅስቃሴዎችን ለማየት ጨረታውን ይክፈቱ።`,
        },
        "watchlist.auction.approved": { title: "ጨረታ ተዘጋጅቷል", message: `“${auctionName}” ተዘጋጅቶ ለመከታተል ይገኛል።` },
        "watchlist.auction.opened": { title: "ጨረታው ተከፍቷል", message: `በ“${auctionName}” ላይ ጨረታ መስጠት አሁን ተጀምሯል።` },
        "watchlist.auction.closed": { title: "የጨረታ ጊዜ ተዘግቷል", message: `በ“${auctionName}” ላይ የጨረታ ጊዜ ተዘግቷል። ውጤቱ አሁንም በግምገማ ላይ ሊሆን ይችላል።` },
        "watchlist.auction.under_review": { title: "ጨረታው በግምገማ ላይ ነው", message: `የ“${auctionName}” ውጤት በግምገማ ላይ ነው።` },
        "watchlist.auction.awarded": { title: "ጨረታ ተሸልሟል", message: `የ“${auctionName}” ውጤት ተሸልሟል።` },
        "watchlist.auction.cancelled": { title: "ጨረታ ተሰርዟል", message: `“${auctionName}” ተሰርዟል።` },
      };
      const translation = localized[payload.type];
      if (translation) ({ title, message } = translation);
    }

    const icon = payload.type.includes("outbid")
      ? "⚠️"
      : payload.type.includes("won") || payload.type.includes("awarded")
        ? "🏆"
        : payload.type.includes("deposit")
          ? "💳"
          : "📢";

    const text = [
      `${icon} <b>${escapeHtml(title)}</b>`,
      ``,
      `${escapeHtml(message)}`,
    ].join("\n");

    const buttons: any[] = [];
    if (payload.relatedEntityType === "auction" && payload.relatedEntityId) {
      buttons.push([
        Markup.button.callback(language === "am" ? "👁️ ጨረታውን ይመልከቱ" : "👁️ View Auction", `view_${payload.relatedEntityId}`),
        Markup.button.callback(language === "am" ? "🛡️ ኦዲቱን ያረጋግጡ" : "🛡️ Verify Audit", `verify_${payload.relatedEntityId}`),
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
    if (!this.bot) {
      this.inboundTransport = "disabled";
      return;
    }

    if (env.TELEGRAM_WEBHOOK_URL) {
      const webhookUrl = `${env.TELEGRAM_WEBHOOK_URL.replace(/\/$/, "")}/api/v1/telegram/webhook`;
      this.inboundTransport = "starting";
      try {
        await this.bot.telegram.setWebhook(webhookUrl, {
          secret_token: env.TELEGRAM_WEBHOOK_SECRET,
        });
        this.inboundTransport = "webhook";
        this.inboundError = null;
        logger.info({ webhookUrl }, "Telegram webhook registered");
      } catch (error) {
        this.inboundTransport = "error";
        this.inboundError = error instanceof Error ? error.message : "Webhook registration failed";
        logger.error({ err: error, webhookUrl }, "Telegram webhook registration failed");
      }
    } else if (env.TELEGRAM_POLLING || env.NODE_ENV === "development") {
      this.inboundTransport = "starting";
      this.inboundError = null;
      // Long-polling needs any previously registered webhook removed first.
      try {
        await this.bot.telegram.deleteWebhook();
      } catch (error) {
        this.inboundTransport = "error";
        this.inboundError = error instanceof Error ? error.message : "Could not clear the Telegram webhook";
        logger.error({ err: error }, "Could not clear Telegram webhook before polling");
        return;
      }
      void this.bot.launch(() => {
        this.isPolling = true;
        this.inboundTransport = "polling";
        logger.info("Telegram bot polling started");
      }).catch((error) => {
        this.isPolling = false;
        this.inboundTransport = "error";
        this.inboundError = error instanceof Error ? error.message : "Telegram polling failed to start";
        logger.error({ err: error }, "Telegram bot polling failed to start");
      });
    } else {
      this.inboundTransport = "disabled";
      logger.warn(
        "Telegram bot is configured but no inbound transport is enabled; set TELEGRAM_WEBHOOK_URL or TELEGRAM_POLLING=true",
      );
    }
  }

  async stop(): Promise<void> {
    if (this.bot && this.isPolling) {
      this.bot.stop("SIGTERM");
      this.isPolling = false;
      this.inboundTransport = "disabled";
      logger.info("Telegram bot polling stopped");
    }
  }
}
