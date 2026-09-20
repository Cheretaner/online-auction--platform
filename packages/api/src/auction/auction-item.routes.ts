import { Router } from "express";
import { CreateAuctionItemRequest, UpdateAuctionItemRequest } from "@auction/shared";
import { optionalAuth, requireAuth } from "../shared/middleware/auth.middleware.js";
import { asyncHandler } from "../shared/middleware/asyncHandler.js";
import { validate } from "../shared/middleware/validate.middleware.js";
import * as controller from "./auction-item.controller.js";

// mergeParams gives access to :auctionId from the parent mount point.
export const auctionItemRouter = Router({ mergeParams: true });

const OFFICERS = ["auction_officer", "org_admin", "super_admin"] as const;

// Reading an auction's lots is part of public discovery (FR6).
auctionItemRouter.get("/", optionalAuth(), asyncHandler(controller.getAuctionItems));
auctionItemRouter.get("/:id", optionalAuth(), asyncHandler(controller.getAuctionItem));

auctionItemRouter.post(
  "/",
  requireAuth([...OFFICERS]),
  validate(CreateAuctionItemRequest),
  asyncHandler(controller.createAuctionItem),
);

auctionItemRouter.patch(
  "/:id",
  requireAuth([...OFFICERS]),
  validate(UpdateAuctionItemRequest),
  asyncHandler(controller.updateAuctionItem),
);

auctionItemRouter.delete(
  "/:id",
  requireAuth([...OFFICERS]),
  asyncHandler(controller.deleteAuctionItem),
);
