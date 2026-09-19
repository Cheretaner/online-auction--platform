import { Router } from "express";
import { CreateOrganizationRequest } from "@auction/shared";
import { requireAuth } from "../shared/middleware/auth.middleware.js";
import { validate } from "../shared/middleware/validate.middleware.js";
import * as controller from "./organization.controller.js";

export const organizationRouter = Router();

organizationRouter.get("/", requireAuth(), controller.list);
organizationRouter.get("/:id", requireAuth(), controller.getById);
organizationRouter.post("/", requireAuth(["organization_admin", "super_admin"]), validate(CreateOrganizationRequest), controller.create);
