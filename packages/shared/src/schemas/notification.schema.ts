import { z } from "zod";
import { NOTIFICATION_CHANNEL } from "../enums.js";

export const SendNotificationRequest = z.object({
  userId: z.string().uuid(),
  channel: z.enum(NOTIFICATION_CHANNEL),
  type: z.string().min(3).max(80),
  title: z.string().min(3).max(200),
  message: z.string().min(1).max(4000),
  relatedEntityType: z.string().max(80).optional(),
  relatedEntityId: z.string().uuid().optional(),
});
export type SendNotificationRequest = z.infer<typeof SendNotificationRequest>;
