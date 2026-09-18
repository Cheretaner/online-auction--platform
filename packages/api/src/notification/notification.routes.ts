import { Router } from "express";
import { SendNotificationRequest } from "@auction/shared";
import { requireAuth } from "../shared/middleware/auth.middleware.js";
import { asyncHandler } from "../shared/middleware/asyncHandler.js";
import { validate } from "../shared/middleware/validate.middleware.js";
import * as controller from "./notification.controller.js";

export const notificationRouter = Router();

notificationRouter.get("/", requireAuth(), asyncHandler(controller.list));
notificationRouter.patch("/:id/read", requireAuth(), asyncHandler(controller.markRead));
notificationRouter.post(
  "/",
  requireAuth(["org_admin", "compliance_officer", "super_admin"]),
  validate(SendNotificationRequest),
  asyncHandler(controller.send),
);
