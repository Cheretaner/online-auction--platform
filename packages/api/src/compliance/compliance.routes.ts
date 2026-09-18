import { Router } from "express";
import { RunComplianceRequest } from "@auction/shared";
import { requireAuth } from "../shared/middleware/auth.middleware.js";
import { asyncHandler } from "../shared/middleware/asyncHandler.js";
import { validate } from "../shared/middleware/validate.middleware.js";
import * as controller from "./compliance.controller.js";

export const complianceRouter = Router();

complianceRouter.post(
  "/auctions/:auctionId/checks",
  requireAuth(["compliance_officer", "org_admin", "super_admin"]),
  validate(RunComplianceRequest),
  asyncHandler(controller.runCheck),
);

complianceRouter.get(
  "/auctions/:auctionId/checks",
  requireAuth(["compliance_officer", "org_admin", "auction_officer", "super_admin"]),
  asyncHandler(controller.listChecks),
);
