import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../shared/middleware/asyncHandler.js";
import { createRateLimiter } from "../shared/middleware/rateLimit.middleware.js";
import { validate } from "../shared/middleware/validate.middleware.js";
import * as controller from "./open-data.controller.js";

export const openDataRouter = Router();

const listQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(100),
  offset: z.coerce.number().int().min(0).max(1_000_000).default(0),
});

openDataRouter.get(
  "/auctions",
  createRateLimiter({
    windowMs: 60_000,
    limit: 60,
    skip: () => false,
    message: { error: { message: "Open-data request limit reached; retry shortly." } },
  }),
  validate(listQuery, "query"),
  asyncHandler(controller.listAuctions),
);
