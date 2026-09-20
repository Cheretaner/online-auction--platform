import { Router } from "express";
import { SendNotificationRequest } from "@auction/shared";
import { requireAuth } from "../shared/middleware/auth.middleware.js";
import { asyncHandler } from "../shared/middleware/asyncHandler.js";
import { validate } from "../shared/middleware/validate.middleware.js";
import * as controller from "./notification.controller.js";

export const notificationRouter = Router();

notificationRouter.get("/", requireAuth(), asyncHandler(controller.list));
notificationRouter.get("/unread-count", requireAuth(), asyncHandler(controller.unreadCount));

// markRead existed as a handler but had no route, so notifications could
// never be cleared from a user's list.
notificationRouter.post("/:id/read", requireAuth(), asyncHandler(controller.markRead));
notificationRouter.post("/read-all", requireAuth(), asyncHandler(controller.markAllRead));

notificationRouter.post(
  "/",
  requireAuth(["org_admin", "super_admin"]),
  validate(SendNotificationRequest),
  asyncHandler(controller.send),
);
