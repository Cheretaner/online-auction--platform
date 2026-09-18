import { Router } from "express";
import { AssignDisputeRequest, OpenDisputeRequest, ResolveDisputeRequest } from "@auction/shared";
import { requireAuth } from "../shared/middleware/auth.middleware.js";
import { asyncHandler } from "../shared/middleware/asyncHandler.js";
import { validate } from "../shared/middleware/validate.middleware.js";
import * as controller from "./dispute.controller.js";

export const disputeRouter = Router();

disputeRouter.post("/", requireAuth(["bidder"]), validate(OpenDisputeRequest), asyncHandler(controller.create));
disputeRouter.get(
  "/",
  requireAuth(["bidder", "compliance_officer", "org_admin", "auction_officer", "super_admin"]),
  asyncHandler(controller.list),
);
disputeRouter.post(
  "/:id/assign",
  requireAuth(["compliance_officer", "org_admin", "super_admin"]),
  validate(AssignDisputeRequest),
  asyncHandler(controller.assign),
);
disputeRouter.post(
  "/:id/resolve",
  requireAuth(["compliance_officer", "org_admin", "super_admin"]),
  validate(ResolveDisputeRequest),
  asyncHandler(controller.resolve),
);
