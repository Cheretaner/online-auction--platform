import { Router } from "express";
import { requireAuth } from "../shared/middleware/auth.middleware.js";
import { asyncHandler } from "../shared/middleware/asyncHandler.js";
import * as controller from "./watchlist.controller.js";

export const watchlistRouter = Router();

// Watchlist endpoints
watchlistRouter.post("/", requireAuth(), asyncHandler(controller.addToWatchlist));
watchlistRouter.get("/", requireAuth(), asyncHandler(controller.getWatchlist));
watchlistRouter.delete("/:auctionId", requireAuth(), asyncHandler(controller.removeFromWatchlist));

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
