import { Router } from "express";
import { GenerateReportRequest, OptionalAuctionScopedQuery } from "@auction/shared";
import { optionalAuth, requireAuth } from "../shared/middleware/auth.middleware.js";
import { asyncHandler } from "../shared/middleware/asyncHandler.js";
import { validate } from "../shared/middleware/validate.middleware.js";
import * as controller from "./reporting.controller.js";

export const reportingRouter = Router();

const AUTHORS = ["compliance_officer", "org_admin", "auction_officer", "super_admin"] as const;
const PUBLISHERS = ["compliance_officer", "org_admin", "super_admin"] as const;

reportingRouter.post(
  "/",
  requireAuth([...AUTHORS]),
  validate(GenerateReportRequest),
  asyncHandler(controller.generate),
);

reportingRouter.get(
  "/",
  requireAuth([...AUTHORS]),
  validate(OptionalAuctionScopedQuery, "query"),
  asyncHandler(controller.list),
);

// A published report is the public transparency artefact (FR16), so it is
// readable without authentication; unpublished drafts are not.
reportingRouter.get("/:id", optionalAuth(), asyncHandler(controller.getById));

// publish had a handler but no route, so no report could ever be made public.
reportingRouter.post("/:id/publish", requireAuth([...PUBLISHERS]), asyncHandler(controller.publish));
