import { Router } from "express";
import { requireAuth } from "../shared/middleware/auth.middleware.js";
import * as controller from "./organization.controller.js";

export const organizationRouter = Router();

organizationRouter.get("/", requireAuth(), controller.list);
organizationRouter.post("/", requireAuth(["org_admin", "super_admin"]), controller.create);
