import { z } from "zod";
import { Router } from "express";
import { requireAuth } from "../shared/middleware/auth.middleware.js";
import { asyncHandler } from "../shared/middleware/asyncHandler.js";
import { validate } from "../shared/middleware/validate.middleware.js";
import * as controller from "./settlement.controller.js";

export const settlementRouter = Router();

settlementRouter.get("/me", requireAuth(), asyncHandler(controller.listMine));
settlementRouter.post(
  "/:auctionId/initiate",
  requireAuth(["bidder"]),
  validate(z.object({ auctionId: z.string().uuid() }), "params"),
  asyncHandler(controller.initiate),
);