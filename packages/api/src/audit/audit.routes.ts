import { Router } from "express";
import { requireAuth } from "../shared/middleware/auth.middleware.js";
import { asyncHandler } from "../shared/middleware/asyncHandler.js";
import * as controller from "./audit.controller.js";

export const auditRouter = Router();

// Results may be independently checked without an account. This endpoint
// returns only chain integrity and cryptographic hashes, never audit events.
auditRouter.get(
  "/public/auctions/:auctionId/verify",
  asyncHandler(controller.verifyPublicAuction),
);

auditRouter.get(
  "/analytics/export",
  requireAuth(["compliance_officer", "org_admin", "auction_officer", "super_admin"]),
  asyncHandler(controller.exportAnalytics),
);

auditRouter.get(
  "/events",
  requireAuth(["compliance_officer", "org_admin", "auction_officer", "super_admin"]),
  asyncHandler(controller.list),
);

auditRouter.get(
  "/verify",
  requireAuth(["compliance_officer", "org_admin", "super_admin"]),
  asyncHandler(controller.verify),
);

auditRouter.get(
  "/auctions/:auctionId/verify",
  requireAuth(["compliance_officer", "org_admin", "super_admin"]),
  asyncHandler(controller.verifyAuction),
);
