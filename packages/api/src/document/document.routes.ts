import { Router } from "express";
import multer from "multer";
import { AuctionScopedQuery } from "@auction/shared";
import { requireAuth } from "../shared/middleware/auth.middleware.js";
import { asyncHandler } from "../shared/middleware/asyncHandler.js";
import { validate } from "../shared/middleware/validate.middleware.js";
import * as controller from "./document.controller.js";

// Files are buffered in memory and then handed to the storage adapter, so
// the limit is deliberately well below the container memory budget.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 1 },
});

export const documentRouter = Router();

documentRouter.post(
  "/",
  requireAuth(["auction_officer", "org_admin", "compliance_officer", "bidder", "super_admin"]),
  upload.single("file"),
  asyncHandler(controller.upload),
);

documentRouter.get("/me", requireAuth(), asyncHandler(controller.listMine));

documentRouter.get(
  "/",
  requireAuth(),
  validate(AuctionScopedQuery, "query"),
  asyncHandler(controller.listByAuction),
);

documentRouter.get("/:id", requireAuth(), asyncHandler(controller.getById));
documentRouter.get("/:id/content", requireAuth(), asyncHandler(controller.download));
