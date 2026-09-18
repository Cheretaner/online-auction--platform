import { DOMAIN_EVENTS } from "../kernel/events.js";
import { enqueueOutbox } from "../infrastructure/outbox/outbox.repository.js";
import { AppError, HttpStatus } from "../shared/errors/index.js";
import * as repo from "./notification.repository.js";
import type { EnqueueNotificationInput, Notification } from "./notification.types.js";

export async function enqueueNotification(input: EnqueueNotificationInput): Promise<Notification> {
  const notification = await repo.insertNotification(input);
  await enqueueOutbox({
    aggregateType: "notification",
    aggregateId: notification.id,
    eventType: DOMAIN_EVENTS.NOTIFICATION_QUEUED,
    payload: {
      notificationId: notification.id,
      userId: notification.userId,
      type: notification.type,
      channel: notification.channel,
    },
  });
  return notification;
}

export async function notifyMany(inputs: EnqueueNotificationInput[]): Promise<void> {
  for (const input of inputs) {
    await enqueueNotification(input);
  }
}

export async function listNotifications(userId: string, unreadOnly = false): Promise<Notification[]> {
  return repo.listByUser(userId, unreadOnly);
}

export async function markNotificationRead(id: string, userId: string): Promise<Notification> {
  const notification = await repo.markRead(id, userId);
  if (!notification) {
    throw new AppError("Notification not found", HttpStatus.NOT_FOUND, "NOTIFICATION_NOT_FOUND");
  }
  return notification;
}
