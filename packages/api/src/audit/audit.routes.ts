import { Router } from "express";
import { requireAuth } from "../shared/middleware/auth.middleware.js";
import * as controller from "./audit.controller.js";

export const auditRouter = Router();

auditRouter.post("/events", requireAuth(["compliance_officer", "super_admin"]), controller.record);
