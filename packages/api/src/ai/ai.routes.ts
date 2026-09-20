import { Router } from "express";
import {
  AssistRequest,
  CategorizeRequest,
  DetectAnomalyRequest,
  OptionalAuctionScopedQuery,
  ReviewAnomalyRequest,
} from "@auction/shared";
import { requireAuth } from "../shared/middleware/auth.middleware.js";
import { asyncHandler } from "../shared/middleware/asyncHandler.js";
import { validate } from "../shared/middleware/validate.middleware.js";
import * as controller from "./ai.controller.js";

export const aiRouter = Router();

aiRouter.post(
  "/categorize",
  requireAuth(["auction_officer", "org_admin", "compliance_officer", "super_admin"]),
  validate(CategorizeRequest),
  asyncHandler(controller.categorize),
);

aiRouter.post(
  "/anomaly",
  requireAuth(["compliance_officer", "org_admin", "super_admin"]),
  validate(DetectAnomalyRequest),
  asyncHandler(controller.detectAnomaly),
);

aiRouter.get(
  "/anomalies",
  requireAuth(["compliance_officer", "org_admin", "auction_officer", "super_admin"]),
  validate(OptionalAuctionScopedQuery, "query"),
  asyncHandler(controller.listAnomalies),
);

aiRouter.post(
  "/anomalies/:id/review",
  requireAuth(["compliance_officer", "org_admin", "super_admin"]),
  validate(ReviewAnomalyRequest),
  asyncHandler(controller.reviewAnomaly),
);

aiRouter.post("/assist", requireAuth(), validate(AssistRequest), asyncHandler(controller.assist));
