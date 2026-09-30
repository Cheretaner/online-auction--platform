import { Router } from "express";
import { PlaceBidRequest, WithdrawBidRequest } from "@auction/shared";
import { requireAuth } from "../shared/middleware/auth.middleware.js";
import { asyncHandler } from "../shared/middleware/asyncHandler.js";
import { idempotencyMiddleware } from "../shared/middleware/idempotency.middleware.js";
import { validate } from "../shared/middleware/validate.middleware.js";
import * as controller from "./bidding.controller.js";

export const biddingRouter = Router({ mergeParams: true });

biddingRouter.get("/", requireAuth(), asyncHandler(controller.listBids));

biddingRouter.post(
  "/",
  requireAuth(["bidder"]),
  idempotencyMiddleware({ required: true }),
  validate(PlaceBidRequest),
  asyncHandler(controller.placeBid),
);

biddingRouter.post(
  "/:bidId/withdraw",
  requireAuth(["bidder"]),
  validate(WithdrawBidRequest),
  asyncHandler(controller.withdrawBid),
);

biddingRouter.post(
  "/open-sealed",
  requireAuth(["auction_officer", "compliance_officer", "org_admin", "super_admin"]),
  asyncHandler(controller.openSealed),
);
