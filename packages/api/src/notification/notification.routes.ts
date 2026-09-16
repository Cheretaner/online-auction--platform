import { Router } from "express";
import { requireAuth } from "../shared/middleware/auth.middleware.js";
import * as controller from "./notification.controller.js";

export const notificationRouter = Router();

notificationRouter.get("/", requireAuth(), controller.list);
notificationRouter.post("/", requireAuth(["org_admin", "super_admin"]), controller.send);
