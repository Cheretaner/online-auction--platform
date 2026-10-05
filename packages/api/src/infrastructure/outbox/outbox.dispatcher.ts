import { mailAdapter } from "../mail/mail.adapter.js";
import { realtimeAdapter } from "../realtime/realtime.adapter.js";
import { telegramService } from "../../telegram/telegram.service.js";
import { twilioVoiceService } from "../voice/twilio.service.js";
import { logger } from "../../shared/utils/logger.js";
import { withTransaction } from "../database/tx.js";
import * as notificationRepo from "../../notification/notification.repository.js";
import * as outboxRepo from "./outbox.repository.js";
import { queryOne } from "../database/query.js";
import { refundNonWinnerChapaDeposits } from "../../payments/payment.service.js";
import { notifyWatchers } from "../../watchlist/watchlist.service.js";

type ClaimedNotification = Awaited<ReturnType<typeof notificationRepo.claimNotificationById>>;

function localizeEmailNotification(item: NonNullable<ClaimedNotification>, language: "en" | "am") {
  if (language !== "am" || !item.type.startsWith("watchlist.")) return { title: item.title, message: item.message };
  const auction = item.message.match(/"([^\"]+)"/)?.[1] ?? "";
  const messages: Record<string, { title: string; message: string }> = {
    "watchlist.bid.placed": {
      title: "አዲስ የጨረታ እንቅስቃሴ",
      message: `በ“${auction}” ላይ አዲስ የጨረታ እንቅስቃሴ ተመዝግቧል። ብቁ እንቅስቃሴዎችን ለማየት ጨረታውን ይክፈቱ።`,
    },
    "watchlist.auction.approved": { title: "ጨረታ ተዘጋጅቷል", message: `“${auction}” ተዘጋጅቶ ለመከታተል ይገኛል።` },
    "watchlist.auction.opened": { title: "ጨረታው ተከፍቷል", message: `በ“${auction}” ላይ ጨረታ መስጠት ተጀምሯል።` },
    "watchlist.auction.closed": { title: "የጨረታ ጊዜ ተዘግቷል", message: `በ“${auction}” ላይ የጨረታ ጊዜ ተዘግቷል። ውጤቱ በግምገማ ላይ ሊሆን ይችላል።` },
    "watchlist.auction.under_review": { title: "ጨረታው በግምገማ ላይ ነው", message: `የ“${auction}” ውጤት በግምገማ ላይ ነው።` },
    "watchlist.auction.awarded": { title: "ጨረታ ተሸልሟል", message: `የ“${auction}” ውጤት ተሸልሟል።` },
    "watchlist.auction.cancelled": { title: "ጨረታ ተሰርዟል", message: `“${auction}” ተሰርዟል።` },
  };
  return messages[item.type] ?? { title: item.title, message: item.message };
}

/** Sends one already-claimed notification and records the outcome. Shared
 * by the outbox-triggered path (near-real-time) and the periodic retry
 * sweep, so delivery + status bookkeeping lives in exactly one place. */
async function sendClaimedNotification(item: NonNullable<ClaimedNotification>): Promise<void> {
  try {
    if (item.channel === "email") {
      if (!item.email) {
        throw new Error("Profile email missing");
      }
      const language = await notificationRepo.preferredLanguage(item.userId);
      const localized = localizeEmailNotification(item, language ?? "en");
      await mailAdapter.send({ to: item.email, subject: localized.title, body: localized.message });
    } else if (item.channel === "telegram") {
      const delivered = await telegramService.notifyUser(item.userId, {
        title: item.title,
        message: item.message,
        type: item.type,
        relatedEntityType: item.relatedEntityType,
        relatedEntityId: item.relatedEntityId,
      });
      if (!delivered) {
        logger.debug({ notificationId: item.id, userId: item.userId }, "Telegram notification skipped (user unlinked or bot offline)");
      }
    } else if (item.channel === "voice") {
      // Voice call notification via Twilio
      const phoneData = await queryOne<{ phone_number: string | null; phone_verified: boolean }>(
        `SELECT phone_number, phone_verified FROM profiles WHERE id = $1`,
        [item.userId],
      );

      if (!phoneData?.phone_number || !phoneData.phone_verified) {
        throw new Error("Phone number not verified");
      }

      if (!twilioVoiceService.isEnabled()) {
        throw new Error("Voice service not configured");
      }

      // Format message for voice (simpler, clearer)
      const voiceMessage = `${item.title}. ${item.message}`;

      const result = await twilioVoiceService.makeCall({
        to: phoneData.phone_number,
        message: voiceMessage,
        priority: item.type.includes('urgent') ? 'high' : 'normal',
      });

      if (!result.success) {
        throw new Error(result.error || 'Voice call failed');
      }

      logger.info({
        event: 'notification:voice_call_sent',
        userId: item.userId,
        notificationId: item.id,
        callSid: result.callSid,
      });
    }

    await notificationRepo.markSent(item.id);
    await realtimeAdapter.publish({
      channel: `user:${item.userId}`,
      event: "notification.sent",
      payload: item,
    });
  } catch (error) {
    await notificationRepo.markFailed(item.id, error instanceof Error ? error.message : String(error));
  }
}

/** Dispatches exactly the notification referenced by the outbox message.
 * Claims by id (not "the next pending row") so a burst of concurrent
 * `notification.queued` events can never send the wrong notification. */
async function dispatchNotification(id: string): Promise<void> {
  const item = await notificationRepo.claimNotificationById(id);
  if (!item) return; // already dispatched, or picked up by the retry sweep first
  await sendClaimedNotification(item);
}

/** Drains the transactional outbox: broadcasts every domain event over
 * realtime (per-aggregate and, where applicable, per-auction channels) and
 * triggers near-immediate delivery for freshly queued notifications. Must
 * run on a short interval - see scheduler.ts - or nothing written via
 * `enqueueOutbox` (bids, extensions, disputes, anomalies, reports, ...)
 * is ever actually delivered. */
export async function processOutboxBatch(): Promise<number> {
  // Claim under a short transaction, then deliver outside it. Telegram and
  // realtime calls can take seconds; they must not hold database locks open.
  const messages = await withTransaction(() => outboxRepo.claimOutboxBatch(40));
  for (const message of messages) {
    try {
      await realtimeAdapter.publish({
        channel: `${message.aggregateType}:${message.aggregateId}`,
        event: message.eventType,
        payload: message.payload,
      });

      const auctionId =
        typeof message.payload.auctionId === "string"
          ? message.payload.auctionId
          : message.aggregateType === "auction"
            ? message.aggregateId
            : undefined;

      if (auctionId && message.aggregateType !== "auction") {
        // T02: Strip bidder identity from public auction channels.
        // The user: channel carries the full payload; the auction:
        // channel is public and must not leak who placed the bid.
        const publicPayload = { ...message.payload };
        delete (publicPayload as Record<string, unknown>).bidderId;
        await realtimeAdapter.publish({
          channel: `auction:${auctionId}`,
          event: message.eventType,
          payload: publicPayload,
        });
      }

      if (auctionId && (
        message.eventType === "bid.placed" ||
        ["auction.approved", "auction.opened", "auction.closed", "auction.under_review", "auction.awarded", "auction.cancelled"].includes(message.eventType)
      )) {
        await notifyWatchers(message.eventType, message.payload, message.id);
      }

      if (auctionId && (message.eventType === "auction.awarded" || message.eventType === "auction.cancelled")) {
        const winnerId =
          message.eventType === "auction.awarded" && typeof message.payload.winnerId === "string"
            ? message.payload.winnerId
            : null;
        await refundNonWinnerChapaDeposits(auctionId, winnerId);
      }

      if (auctionId && message.eventType === "settlement.paid") {
        await refundNonWinnerChapaDeposits(auctionId, null);
      }

      if (message.eventType === "notification.queued" && typeof message.payload.notificationId === "string") {
        await dispatchNotification(message.payload.notificationId);
      }

      await outboxRepo.markOutboxProcessed(message.id);
    } catch (error) {
      logger.error({ err: error, outboxId: message.id }, "Outbox dispatch failed");
      await outboxRepo.markOutboxFailed(message.id, error instanceof Error ? error.message : String(error));
    }
  }
  return messages.length;
}

/** Safety-net retry sweep for notifications whose first attempt failed
 * (e.g. SMTP was briefly down). Runs on a slower interval than
 * `processOutboxBatch` - see scheduler.ts. */
export async function processNotificationQueue(): Promise<number> {
  return withTransaction(async () => {
    const batch = await notificationRepo.claimDispatchBatch(25);
    for (const item of batch) {
      await sendClaimedNotification(item);
    }
    return batch.length;
  });
}
