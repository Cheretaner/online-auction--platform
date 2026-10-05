import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../shared/middleware/auth.middleware.js";
import { asyncHandler } from "../shared/middleware/asyncHandler.js";
import { validate } from "../shared/middleware/validate.middleware.js";
import * as controller from "./watchlist.controller.js";

export const watchlistRouter = Router();

watchlistRouter.get("/", requireAuth(), asyncHandler(controller.list));
watchlistRouter.put(
  "/:auctionId",
  requireAuth(),
  validate(z.object({ auctionId: z.string().uuid() }).strict(), "params"),
  asyncHandler(controller.replace),
);
watchlistRouter.delete(
  "/:auctionId",
  requireAuth(),
  validate(z.object({ auctionId: z.string().uuid() }).strict(), "params"),
  asyncHandler(controller.remove),
);
watchlistRouter.post("/", requireAuth(), asyncHandler(controller.addToWatchlist));

export const savedSearchRouter = Router();

// Saved searches endpoints
savedSearchRouter.post("/", requireAuth(), asyncHandler(controller.createSavedSearch));
savedSearchRouter.get("/", requireAuth(), asyncHandler(controller.getSavedSearches));
savedSearchRouter.patch("/:id", requireAuth(), asyncHandler(controller.updateSavedSearch));
savedSearchRouter.delete("/:id", requireAuth(), asyncHandler(controller.deleteSavedSearch));

export const notificationPreferencesRouter = Router();

// Notification preferences endpoints
notificationPreferencesRouter.post("/", requireAuth(), asyncHandler(controller.setNotificationPreference));
notificationPreferencesRouter.get("/", requireAuth(), asyncHandler(controller.getNotificationPreferences));
