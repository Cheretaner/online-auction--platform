import { Router } from "express";
import { CreateDepositRequest, ReviewDepositRequest } from "@auction/shared";
import { requireAuth } from "../shared/middleware/auth.middleware.js";
import { validate } from "../shared/middleware/validate.middleware.js";
import * as controller from "./deposit.controller.js";

export const depositRouter = Router();

depositRouter.post("/", requireAuth(["bidder"]), validate(CreateDepositRequest), controller.create);
depositRouter.get("/", requireAuth(["auction_officer", "organization_admin"]), controller.listByAuction);
depositRouter.get("/:id", requireAuth(), controller.getById);
depositRouter.post("/:id/review", requireAuth(["auction_officer", "organization_admin"]), validate(ReviewDepositRequest), controller.review);
depositRouter.post("/:id/release", requireAuth(["auction_officer", "organization_admin"]), controller.release);
