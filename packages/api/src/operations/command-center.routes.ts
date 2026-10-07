import { Router } from "express";
import { requireAuth } from "../shared/middleware/auth.middleware.js";
import { asyncHandler } from "../shared/middleware/asyncHandler.js";
import { listCommandCenterExceptions } from "./command-center.controller.js";

export const commandCenterRouter = Router();

commandCenterRouter.get(
  "/exceptions",
  requireAuth(["auction_officer", "org_admin", "compliance_officer", "super_admin"]),
  asyncHandler(listCommandCenterExceptions),
);
