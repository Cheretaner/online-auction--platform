import { Router } from "express";
import { LoginRequest, RegisterRequest } from "@auction/shared";
import { validate } from "../shared/middleware/validate.middleware.js";
import * as controller from "./identity.controller.js";

export const identityRouter = Router();

identityRouter.post("/register", validate(RegisterRequest), controller.register);
identityRouter.post("/login", validate(LoginRequest), controller.login);
