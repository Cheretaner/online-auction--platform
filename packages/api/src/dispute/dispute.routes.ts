import { Router } from "express";
import {
  AssignDisputeRequest,
  OpenDisputeRequest,
  OptionalAuctionScopedQuery,
  ResolveDisputeRequest,
} from "@auction/shared";
import { requireAuth } from "../shared/middleware/auth.middleware.js";
import { asyncHandler } from "../shared/middleware/asyncHandler.js";
import { validate } from "../shared/middleware/validate.middleware.js";
import * as controller from "./dispute.controller.js";

export const disputeRouter = Router();

const REVIEWERS = ["compliance_officer", "org_admin", "auction_officer", "super_admin"] as const;

disputeRouter.post(
  "/",
  requireAuth(),
  validate(OpenDisputeRequest),
  asyncHandler(controller.create),
);

// Any authenticated user may list: the service narrows the result to the
// caller's own disputes unless they hold a reviewer role.
disputeRouter.get(
  "/",
  requireAuth(),
  validate(OptionalAuctionScopedQuery, "query"),
  asyncHandler(controller.list),
);

disputeRouter.get(
  "/:id/evidence-bundle",
  requireAuth([...REVIEWERS]),
  asyncHandler(controller.downloadEvidenceBundle),
);

disputeRouter.get("/:id", requireAuth(), asyncHandler(controller.getById));

// These two handlers existed but were never routed, so disputes could be
// opened and then never progressed.
disputeRouter.post(
  "/:id/assign",
  requireAuth([...REVIEWERS]),
  validate(AssignDisputeRequest),
  asyncHandler(controller.assign),
);

disputeRouter.post(
  "/:id/resolve",
  requireAuth([...REVIEWERS]),
  validate(ResolveDisputeRequest),
  asyncHandler(controller.resolve),
);
