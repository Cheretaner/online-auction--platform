import { Router } from "express";
import { requireAuth } from "../shared/middleware/auth.middleware.js";
import * as controller from "./telegram.controller.js";

export const telegramRouter = Router();

// Telegram Bot Webhook (public, secret-token authenticated via header)
telegramRouter.post("/webhook", controller.handleWebhook);

// User Telegram Account Connection
telegramRouter.post("/link-token", requireAuth(), controller.createLinkToken);
telegramRouter.get("/status", requireAuth(), controller.getLinkStatus);
telegramRouter.delete("/unlink", requireAuth(), controller.unlinkTelegram);
telegramRouter.get(
  "/integration-status",
  requireAuth(["org_admin", "super_admin", "auction_officer"]),
  controller.getIntegrationStatus,
);

// Broadcast an auction to the Telegram Channel (officers & admins)
telegramRouter.post(
  "/broadcast/:auctionId",
  requireAuth(["org_admin", "super_admin", "auction_officer"]),
  controller.broadcastAuction,
);
