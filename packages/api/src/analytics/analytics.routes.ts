import { Router } from "express";
import { requireAuth } from "../shared/middleware/auth.middleware.js";
import { asyncHandler } from "../shared/middleware/asyncHandler.js";
import * as controller from "./analytics.controller.js";

export const analyticsRouter = Router();

const OFFICERS = ["auction_officer", "org_admin", "compliance_officer", "super_admin"] as const;

// Reserve price recommendations
analyticsRouter.get(
  "/auctions/:auctionId/reserve-recommendation",
  requireAuth([...OFFICERS]),
  asyncHandler(controller.getReserveRecommendation),
);

// Historical analytics
analyticsRouter.get(
  "/historical",
  requireAuth([...OFFICERS]),
  asyncHandler(controller.getHistoricalAnalytics),
);

// Bidder insights
analyticsRouter.get(
  "/me/insights",
  requireAuth(),
  asyncHandler(controller.getMyInsights),
);

analyticsRouter.get(
  "/bidders/:bidderId/insights",
  requireAuth(["super_admin"]),
  asyncHandler(controller.getBidderInsights),
);
