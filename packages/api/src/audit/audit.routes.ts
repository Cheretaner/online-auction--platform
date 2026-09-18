import { Router } from "express";
import { requireAuth } from "../shared/middleware/auth.middleware.js";
import { asyncHandler } from "../shared/middleware/asyncHandler.js";
import * as controller from "./audit.controller.js";

export const auditRouter = Router();

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
