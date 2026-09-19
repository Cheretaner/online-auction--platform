import { Router } from "express";
import multer from "multer";
import { requireAuth } from "../shared/middleware/auth.middleware.js";
import * as controller from "./document.controller.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
});

export const documentRouter = Router();

// Officers and bidders can upload documents (bidders upload KYC docs)
documentRouter.post("/", requireAuth(["auction_officer", "organization_admin", "bidder"]), upload.single("file"), controller.upload);
documentRouter.get("/:id", requireAuth(), controller.getById);
documentRouter.get("/", requireAuth(), controller.listByAuction);
