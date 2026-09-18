import { Router } from "express";
import { CreateDepositRequest } from "@auction/shared";
import { requireAuth } from "../shared/middleware/auth.middleware.js";
import { validate } from "../shared/middleware/validate.middleware.js";
import * as controller from "./deposit.controller.js";

export const depositRouter = Router();

depositRouter.post("/", requireAuth(["bidder"]), validate(CreateDepositRequest), controller.create);
