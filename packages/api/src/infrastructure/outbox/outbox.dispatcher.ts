import { mailAdapter } from "../mail/mail.adapter.js";
import { realtimeAdapter } from "../realtime/realtime.adapter.js";
import { logger } from "../../shared/utils/logger.js";
import { withTransaction } from "../database/tx.js";
import * as notificationRepo from "../../notification/notification.repository.js";
import * as outboxRepo from "./outbox.repository.js";

async function dispatchNotification(id: string): Promise<void> {
  const batch = await notificationRepo.claimDispatchBatch(1);
  const item = batch.find((row) => row.id === id) ?? batch[0];
  if (!item) return;

  try {
    if (item.channel === "email") {
      if (!item.email) {
        throw new Error("Profile email missing");
      }
      await mailAdapter.send({
        to: item.email,
        subject: item.title,
        body: item.message,
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
    throw error;
  }
}

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
        if (auctionId) {
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

export async function processNotificationQueue(): Promise<number> {
  return withTransaction(async () => {
    const batch = await notificationRepo.claimDispatchBatch(25);
    for (const item of batch) {
      try {
        if (item.channel === "email") {
          if (!item.email) throw new Error("Profile email missing");
          await mailAdapter.send({
            to: item.email,
            subject: item.title,
            body: item.message,
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
    return batch.length;
  });
}
