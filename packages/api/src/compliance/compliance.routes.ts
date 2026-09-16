import { Router } from "express";
import { requireAuth } from "../shared/middleware/auth.middleware.js";
import * as controller from "./compliance.controller.js";

export const complianceRouter = Router();

complianceRouter.post("/auctions/:auctionId/checks", requireAuth(["compliance_officer"]), controller.runCheck);
complianceRouter.get("/auctions/:auctionId/checks", requireAuth(["compliance_officer"]), controller.listChecks);
