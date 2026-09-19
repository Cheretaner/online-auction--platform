import { Router } from "express";
import { requireAuth } from "../shared/middleware/auth.middleware.js";
import * as controller from "./reporting.controller.js";

export const reportingRouter = Router();

reportingRouter.post("/", requireAuth(["compliance_officer", "organization_admin"]), controller.generate);
reportingRouter.get("/:id", requireAuth(["compliance_officer", "organization_admin"]), controller.getById);
