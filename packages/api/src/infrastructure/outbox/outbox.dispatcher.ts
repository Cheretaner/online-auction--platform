import { mailAdapter } from "../mail/mail.adapter.js";
import { realtimeAdapter } from "../realtime/realtime.adapter.js";
import { logger } from "../../shared/utils/logger.js";
import { withTransaction } from "../database/tx.js";
import * as notificationRepo from "../../notification/notification.repository.js";
import * as outboxRepo from "./outbox.repository.js";

type ClaimedNotification = Awaited<ReturnType<typeof notificationRepo.claimNotificationById>>;

/** Sends one already-claimed notification and records the outcome. Shared
 * by the outbox-triggered path (near-real-time) and the periodic retry
 * sweep, so delivery + status bookkeeping lives in exactly one place. */
async function sendClaimedNotification(item: NonNullable<ClaimedNotification>): Promise<void> {
  try {
    if (item.channel === "email") {
      if (!item.email) {
        throw new Error("Profile email missing");
      }
      await mailAdapter.send({ to: item.email, subject: item.title, body: item.message });
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
  return withTransaction(async () => {
    const messages = await outboxRepo.claimOutboxBatch(40);
    for (const message of messages) {
      try {
        await realtimeAdapter.publish({
          channel: `${message.aggregateType}:${message.aggregateId}`,
          event: message.eventType,
          payload: message.payload,
        });

        const auctionId = typeof message.payload.auctionId === "string" ? message.payload.auctionId : undefined;
        if (auctionId && message.aggregateType !== "auction") {
          await realtimeAdapter.publish({
            channel: `auction:${auctionId}`,
            event: message.eventType,
            payload: message.payload,
          });
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
  });
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
