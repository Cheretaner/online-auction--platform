import { Router } from "express";
import { AddOrganizationMemberRequest, CreateOrganizationRequest } from "@auction/shared";
import { optionalAuth, requireAuth } from "../shared/middleware/auth.middleware.js";
import { asyncHandler } from "../shared/middleware/asyncHandler.js";
import { validate } from "../shared/middleware/validate.middleware.js";
import * as controller from "./organization.controller.js";

export const organizationRouter = Router();

const ADMINS = ["org_admin", "super_admin"] as const;

// Organizations are public: bidders filter auctions by the body running them.
organizationRouter.get("/", optionalAuth(), asyncHandler(controller.list));
organizationRouter.get("/:id", optionalAuth(), asyncHandler(controller.getById));

// Only a platform operator onboards a new organization. The first account
// registered (or BOOTSTRAP_SUPER_ADMIN_EMAIL) is promoted to super_admin so
// this endpoint is reachable on a fresh deployment.
organizationRouter.post(
  "/",
  requireAuth(["super_admin"]),
  validate(CreateOrganizationRequest),
  asyncHandler(controller.create),
);

organizationRouter.get("/:id/members", requireAuth([...ADMINS]), asyncHandler(controller.listMembers));

organizationRouter.post(
  "/:id/members",
  requireAuth([...ADMINS]),
  validate(AddOrganizationMemberRequest),
  asyncHandler(controller.addMember),
);

organizationRouter.delete(
  "/:id/members/:userId",
  requireAuth([...ADMINS]),
  asyncHandler(controller.removeMember),
);
