import { Router } from "express";
import { register, login, getProfile, updateProfile } from "./identity.controller.js";
import { requireAuth } from "../shared/middleware/auth.middleware.js";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.get("/me", requireAuth, getProfile);
router.patch("/me", requireAuth, updateProfile);

export default router;
