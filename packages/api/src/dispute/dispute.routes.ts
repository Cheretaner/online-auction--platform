import { Router } from "express";
import { requireAuth } from "../shared/middleware/auth.middleware.js";
import * as controller from "./dispute.controller.js";

export const disputeRouter = Router();

disputeRouter.post("/", requireAuth(["bidder"]), controller.create);
disputeRouter.get("/", requireAuth(["compliance_officer", "org_admin"]), controller.list);
