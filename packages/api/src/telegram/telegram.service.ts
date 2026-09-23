import { env } from "../config/env.js";
import { logger } from "../shared/utils/logger.js";
import { TelegramBotService } from "./telegram-bot.service.js";
import { TelegramChannelService } from "./telegram-channel.service.js";
import * as telegramRepo from "./telegram.repository.js";
import type { TelegramNotificationPayload } from "./telegram.types.js";

class TelegramService {
  private botService: TelegramBotService;
  private channelService: TelegramChannelService;

  constructor() {
    this.botService = new TelegramBotService();
    this.channelService = new TelegramChannelService(() => this.botService.getBotInstance());
  }

  async start(): Promise<void> {
    await this.botService.start();
  }

  async stop(): Promise<void> {
    await this.botService.stop();
  }

  getBotInstance() {
    return this.botService.getBotInstance();
  }

  /**
   * Generates an 8-character connection code for a user to link their Telegram account.
   */
  async createLinkToken(userId: string): Promise<{ token: string; deepLink: string; expiresAt: string }> {
    const token = await telegramRepo.createLinkToken(userId, 15);
    const botUsername = (env.TELEGRAM_BOT_USERNAME || "cheretanet_bot").replace(/^@/, "");
    const deepLink = `https://t.me/${botUsername}?start=link_${token}`;
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    return { token, deepLink, expiresAt };
  }

  /**
   * Retrieves the current Telegram connection status for a user.
   */
  async getTelegramLinkStatus(userId: string) {
    const profile = await telegramRepo.findProfileByUserId(userId);
    return {
      linked: Boolean(profile?.telegramId),
      telegramId: profile?.telegramId ?? null,
      telegramUsername: profile?.telegramUsername ?? null,
      telegramLinkedAt: profile?.telegramLinkedAt ?? null,
    };
  }

  /**
   * Disconnects a user's Telegram account from their portal profile.
   */
  async unlinkTelegram(userId: string): Promise<void> {
    await telegramRepo.unlinkTelegramUser(userId);
  }

  /**
   * Sends a notification to a specific user via Telegram if they have a linked account.
   */
  async notifyUser(userId: string, payload: TelegramNotificationPayload): Promise<boolean> {
    const profile = await telegramRepo.findProfileByUserId(userId);
    if (!profile?.telegramChatId) {
      logger.debug({ userId }, "User has no linked Telegram chat ID; cannot send notification");
      return false;
    }

    return this.botService.sendDirectNotification(profile.telegramChatId, payload);
  }

  /**
   * Broadcasts an auction announcement or status update to the official public Telegram Channel.
   */
  async broadcastAuction(auctionId: string): Promise<boolean> {
    return this.channelService.broadcastAuction(auctionId);
  }

  /**
   * Processes a webhook update received from Telegram Bot API.
   */
  async handleWebhookUpdate(update: any, secretHeader?: string): Promise<void> {
    if (env.TELEGRAM_WEBHOOK_SECRET && secretHeader !== env.TELEGRAM_WEBHOOK_SECRET) {
      throw new Error("Invalid Telegram webhook secret header");
    }

    const bot = this.botService.getBotInstance();
    if (!bot) {
      throw new Error("Telegram bot not initialized");
    }

    await bot.handleUpdate(update);
  }
}

export const telegramService = new TelegramService();
