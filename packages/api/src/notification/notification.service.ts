import { randomUUID } from "node:crypto";
import { mailAdapter } from "../infrastructure/mail/mail.adapter.js";
import * as repo from "./notification.repository.js";
import type { Notification } from "./notification.types.js";

export async function notifyUser(input: {
  userId: string;
  email?: string;
  channel: Notification["channel"];
  subject: string;
  body: string;
}): Promise<Notification> {
  const notification: Notification = {
    id: randomUUID(),
    userId: input.userId,
    channel: input.channel,
    subject: input.subject,
    body: input.body,
    read: false,
    createdAt: new Date().toISOString(),
  };

  await repo.insertNotification(notification);

  if (input.channel === "email" && input.email) {
    await mailAdapter.send({ to: input.email, subject: input.subject, body: input.body });
  }

  return notification;
}

export async function listNotifications(userId: string): Promise<Notification[]> {
  return repo.listByUser(userId);
}
