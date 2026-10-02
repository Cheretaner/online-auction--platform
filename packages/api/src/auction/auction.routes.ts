import { Router } from "express";
import {
  PublicAuctionListQuery,
  CancelAuctionRequest,
  CreateAuctionRequest,
  TransitionAuctionRequest,
  UpdateAuctionRequest,
} from "@auction/shared";
import { optionalAuth, requireAuth, requireOrganization } from "../shared/middleware/auth.middleware.js";
import { asyncHandler } from "../shared/middleware/asyncHandler.js";
import { validate } from "../shared/middleware/validate.middleware.js";
import * as controller from "./auction.controller.js";
import * as documentSearchController from "../document/document-search.controller.js";

export const auctionRouter = Router();

const OFFICERS = ["auction_officer", "org_admin", "super_admin"] as const;
const APPROVERS = ["org_admin", "compliance_officer", "super_admin"] as const;

// Public discovery (FR6). optionalAuth() is invoked — passing the bare
// factory registered a middleware that never called next() and hung.
auctionRouter.get("/", optionalAuth(), validate(PublicAuctionListQuery, "query"), asyncHandler(controller.listPublic));
auctionRouter.get("/:id", optionalAuth(), asyncHandler(controller.getById));
auctionRouter.get("/:id/documents/search", requireAuth(), asyncHandler(documentSearchController.searchAuctionDocuments));

auctionRouter.post(
  "/",
  requireAuth([...OFFICERS]),
  requireOrganization(),
  validate(CreateAuctionRequest),
  asyncHandler(controller.create),
);

auctionRouter.patch(
  "/:id",
  requireAuth([...OFFICERS]),
  requireOrganization(),
  validate(UpdateAuctionRequest),
  asyncHandler(controller.amend),
);

auctionRouter.post(
  "/:id/submit",
  requireAuth([...OFFICERS]),
  requireOrganization(),
  asyncHandler(controller.submitForApproval),
);

// Approval is a separate role set from creation so the two-person rule in
// auction.service has a population of users who can actually satisfy it.
auctionRouter.post(
  "/:id/approve",
  requireAuth([...APPROVERS]),
  requireOrganization(),
  asyncHandler(controller.approve),
);

auctionRouter.patch(
  "/:id/status",
  requireAuth([...APPROVERS]),
  requireOrganization(),
  validate(TransitionAuctionRequest),
  asyncHandler(controller.transition),
);

auctionRouter.delete(
  "/:id",
  requireAuth([...OFFICERS]),
  requireOrganization(),
  validate(CancelAuctionRequest),
  asyncHandler(controller.cancel),
);

export const orgAuctionRouter = Router({ mergeParams: true });

orgAuctionRouter.get("/", requireAuth(), asyncHandler(controller.listByOrg));
