import { Router } from "express";
import * as controller from "./auction.controller.js";
import { requireAuth, optionalAuth } from "../shared/middleware/auth.middleware.js";

export const auctionRouter = Router();

auctionRouter.get("/", optionalAuth, controller.listPublic);
auctionRouter.get("/:id", optionalAuth, controller.getById);

auctionRouter.post("/", requireAuth, controller.create);
auctionRouter.patch("/:id", requireAuth, controller.amend);
auctionRouter.post("/:id/submit", requireAuth, controller.submitForApproval);
auctionRouter.post("/:id/approve", requireAuth, controller.approve);
auctionRouter.patch("/:id/status", requireAuth, controller.transition);
auctionRouter.delete("/:id", requireAuth, controller.cancel);

export const orgAuctionRouter = Router({ mergeParams: true });

orgAuctionRouter.get("/", requireAuth, controller.listByOrg);
