import { Router } from "express";
import { AuctionScopedQuery } from "@auction/shared";
import { requireAuth } from "../shared/middleware/auth.middleware.js";
import { asyncHandler } from "../shared/middleware/asyncHandler.js";
import { validate } from "../shared/middleware/validate.middleware.js";
import * as controller from "./document.controller.js";
import * as searchController from "./document-search.controller.js";
import { documentUpload } from "./upload.middleware.js";

export const documentRouter = Router();

documentRouter.post(
  "/",
  requireAuth(["auction_officer", "org_admin", "compliance_officer", "bidder", "super_admin"]),
  documentUpload.single("file"),
  asyncHandler(controller.upload),
);

documentRouter.get("/search", requireAuth(), asyncHandler(searchController.searchDocuments));
documentRouter.get("/me", requireAuth(), asyncHandler(controller.listMine));
documentRouter.get("/ocr/search", requireAuth(), asyncHandler(controller.searchReviewedOcr));

documentRouter.get(
  "/",
  requireAuth(),
  validate(AuctionScopedQuery, "query"),
  asyncHandler(controller.listByAuction),
);

documentRouter.get("/:id", requireAuth(), asyncHandler(controller.getById));
documentRouter.get("/:id/content", requireAuth(), asyncHandler(controller.download));
documentRouter.get("/:id/ocr", requireAuth(), asyncHandler(controller.getOcr));
documentRouter.post("/:id/ocr", requireAuth(), asyncHandler(controller.startOcr));
documentRouter.post("/:id/ocr/review", requireAuth(), asyncHandler(controller.reviewOcr));
documentRouter.post("/:id/ocr/reference-review", requireAuth(), asyncHandler(controller.reviewOcrReference));
