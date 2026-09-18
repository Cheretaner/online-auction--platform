import { Router } from "express";
import { GenerateReportRequest } from "@auction/shared";
import { requireAuth } from "../shared/middleware/auth.middleware.js";
import { asyncHandler } from "../shared/middleware/asyncHandler.js";
import { validate } from "../shared/middleware/validate.middleware.js";
import * as controller from "./reporting.controller.js";

const officers = ["compliance_officer", "org_admin", "auction_officer", "super_admin"] as const;

export const reportingRouter = Router();

reportingRouter.post(
  "/",
  requireAuth([...officers]),
  validate(GenerateReportRequest),
  asyncHandler(controller.generate),
);
reportingRouter.get("/", requireAuth([...officers]), asyncHandler(controller.list));
reportingRouter.get("/:id", requireAuth([...officers]), asyncHandler(controller.getById));
reportingRouter.post(
  "/:id/publish",
  requireAuth(["compliance_officer", "org_admin", "super_admin"]),
  asyncHandler(controller.publish),
);
