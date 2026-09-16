import { Router } from "express";
import { CreateAuctionRequest } from "@auction/shared";
import { requireAuth } from "../shared/middleware/auth.middleware.js";
import { validate } from "../shared/middleware/validate.middleware.js";
import * as controller from "./auction.controller.js";

export const auctionRouter = Router();

auctionRouter.post("/", requireAuth(["auction_officer", "org_admin"]), validate(CreateAuctionRequest), controller.create);
auctionRouter.get("/:id", controller.getById);
auctionRouter.patch("/:id/status", requireAuth(["auction_officer", "org_admin"]), controller.transition);
