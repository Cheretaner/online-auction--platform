import { Router } from "express";
import { requireAuth } from "../shared/middleware/auth.middleware.js";
import * as controller from "./ai.controller.js";

export const aiRouter = Router();

aiRouter.post("/categorize", requireAuth(), controller.categorize);
aiRouter.post("/anomaly", requireAuth(["compliance_officer"]), controller.detectAnomaly);
aiRouter.post("/assist", requireAuth(), controller.assist);
