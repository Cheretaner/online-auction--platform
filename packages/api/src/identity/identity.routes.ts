import { Router } from "express";
import {
  LoginRequest,
  PasswordResetConfirm,
  PasswordResetRequest,
  RefreshTokenRequest,
  RegisterRequest,
  UpdateProfileRequest,
} from "@auction/shared";
import { requireAuth } from "../shared/middleware/auth.middleware.js";
import { asyncHandler } from "../shared/middleware/asyncHandler.js";
import { validate } from "../shared/middleware/validate.middleware.js";
import { authRateLimiter } from "../shared/middleware/rateLimit.middleware.js";
import * as controller from "./identity.controller.js";

const router = Router();

// Credential endpoints get their own, much tighter bucket so password
// guessing cannot consume the generous global API allowance.
router.post("/register", authRateLimiter, validate(RegisterRequest), asyncHandler(controller.register));
router.post("/login", authRateLimiter, validate(LoginRequest), asyncHandler(controller.login));
router.post("/refresh", authRateLimiter, validate(RefreshTokenRequest), asyncHandler(controller.refresh));
router.post("/logout", authRateLimiter, validate(RefreshTokenRequest), asyncHandler(controller.logout));
router.post(
  "/password-reset/request",
  authRateLimiter,
  validate(PasswordResetRequest),
  asyncHandler(controller.requestPasswordReset),
);
router.post(
  "/password-reset/confirm",
  authRateLimiter,
  validate(PasswordResetConfirm),
  asyncHandler(controller.confirmPasswordReset),
);

router.get("/me", requireAuth(), asyncHandler(controller.getProfile));
router.patch("/me", requireAuth(), validate(UpdateProfileRequest), asyncHandler(controller.updateProfile));
router.post("/context", requireAuth(), asyncHandler(controller.switchContext));

router.get(
  "/users/:id",
  requireAuth(["compliance_officer", "org_admin", "super_admin"]),
  asyncHandler(controller.getProfileById),
);

export default router;
