import { Router } from "express";
import { ReviewVerificationRequest, SubmitVerificationRequest } from "@auction/shared";
import { requireAuth } from "../shared/middleware/auth.middleware.js";
import { asyncHandler } from "../shared/middleware/asyncHandler.js";
import { validate } from "../shared/middleware/validate.middleware.js";
import { submissionRateLimiter } from "../shared/middleware/rateLimit.middleware.js";
import * as controller from "./verification.controller.js";

const router = Router();

// KYC reviewers. Previously every one of these routes used the un-invoked
// `requireAuth` factory, which both hung the request AND — had it resolved —
// would have let any signed-in bidder approve their own KYC.
const REVIEWERS = ["compliance_officer", "org_admin", "super_admin"] as const;

router.post(
  "/submit",
  requireAuth(),
  submissionRateLimiter,
  validate(SubmitVerificationRequest),
  asyncHandler(controller.submitVerification),
);

router.get("/me", requireAuth(), asyncHandler(controller.getMyVerification));

router.get("/pending", requireAuth([...REVIEWERS]), asyncHandler(controller.listPending));

router.post(
  "/:id/review",
  requireAuth([...REVIEWERS]),
  validate(ReviewVerificationRequest),
  asyncHandler(controller.reviewVerification),
);

router.get(
  "/users/:userId/duplicates",
  requireAuth([...REVIEWERS]),
  asyncHandler(controller.checkDuplicates),
);

export default router;
