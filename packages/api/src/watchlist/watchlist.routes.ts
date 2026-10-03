import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../shared/middleware/asyncHandler.js";
import { requireAuth } from "../shared/middleware/auth.middleware.js";
import { validate } from "../shared/middleware/validate.middleware.js";
import * as controller from "./watchlist.controller.js";

export const watchlistRouter = Router();

watchlistRouter.get("/", requireAuth(), asyncHandler(controller.list));
watchlistRouter.put(
  "/:auctionId",
  requireAuth(),
  validate(z.object({ auctionId: z.string().uuid() }).strict(), "params"),
  asyncHandler(controller.replace),
);
watchlistRouter.delete(
  "/:auctionId",
  requireAuth(),
  validate(z.object({ auctionId: z.string().uuid() }).strict(), "params"),
  asyncHandler(controller.remove),
);
