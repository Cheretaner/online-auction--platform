import { Router } from "express";
import { AuctionScopedQuery, CreateDepositRequest, InitiateChapaDepositRequest, ReleaseDepositRequest, ReviewDepositRequest } from "@auction/shared";
import { requireAuth } from "../shared/middleware/auth.middleware.js";
import { asyncHandler } from "../shared/middleware/asyncHandler.js";
import { validate } from "../shared/middleware/validate.middleware.js";
import { submissionRateLimiter } from "../shared/middleware/rateLimit.middleware.js";
import * as controller from "./deposit.controller.js";

export const depositRouter = Router();

const REVIEWERS = ["auction_officer", "org_admin", "compliance_officer", "super_admin"] as const;

depositRouter.post(
  "/",
  requireAuth(["bidder"]),
  submissionRateLimiter,
  validate(CreateDepositRequest),
  asyncHandler(controller.create),
);

depositRouter.post(
  "/initiate",
  requireAuth(["bidder"]),
  submissionRateLimiter,
  validate(InitiateChapaDepositRequest),
  asyncHandler(controller.initiateChapa),
);

depositRouter.get("/me", requireAuth(), asyncHandler(controller.listMine));
depositRouter.get("/providers", requireAuth(["bidder"]), asyncHandler(controller.paymentProviders));

// auctionId was previously read straight off req.query with no check, so a
// missing value reached SQL as undefined.
depositRouter.get(
  "/",
  requireAuth([...REVIEWERS]),
  validate(AuctionScopedQuery, "query"),
  asyncHandler(controller.listByAuction),
);

depositRouter.get("/:id", requireAuth(), asyncHandler(controller.getById));

depositRouter.post(
  "/:id/review",
  requireAuth([...REVIEWERS]),
  validate(ReviewDepositRequest),
  asyncHandler(controller.review),
);

depositRouter.post(
  "/:id/release",
  requireAuth([...REVIEWERS]),
  validate(ReleaseDepositRequest),
  asyncHandler(controller.release),
);
