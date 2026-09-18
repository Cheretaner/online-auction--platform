import type { NotificationChannel, NotificationStatus } from "@auction/shared";

export interface Notification {
  id: string;
  userId: string;
  channel: NotificationChannel;
  status: NotificationStatus;
  type: string;
  title: string;
  message: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  sentAt?: string;
  readAt?: string;
  failureReason?: string;
  createdAt: string;
}

export interface EnqueueNotificationInput {
  userId: string;
  channel: NotificationChannel;
  type: string;
  title: string;
  message: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
}
