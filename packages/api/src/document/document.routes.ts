import { Router } from "express";
import { requireAuth } from "../shared/middleware/auth.middleware.js";
import * as controller from "./document.controller.js";

export const documentRouter = Router();

documentRouter.post("/", requireAuth(["auction_officer", "org_admin"]), controller.upload);
