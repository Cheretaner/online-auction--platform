import { Router } from "express";
import { PlaceBidRequest } from "@auction/shared";
import { requireAuth } from "../shared/middleware/auth.middleware.js";
import { validate } from "../shared/middleware/validate.middleware.js";
import * as controller from "./bidding.controller.js";

export const biddingRouter = Router({ mergeParams: true });

biddingRouter.post("/", requireAuth(["bidder"]), validate(PlaceBidRequest), controller.placeBid);
