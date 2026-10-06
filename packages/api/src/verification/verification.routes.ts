import { Router } from "express";
import { ReviewVerificationRequest, SubmitVerificationRequest } from "@auction/shared";
import { requireAuth } from "../shared/middleware/auth.middleware.js";
import { asyncHandler } from "../shared/middleware/asyncHandler.js";
import { validate } from "../shared/middleware/validate.middleware.js";
import { submissionRateLimiter } from "../shared/middleware/rateLimit.middleware.js";
import { createVerificationController } from "./verification.controller.js";
import { VerificationService } from "./verification.service.js";
import type { IdentityVerificationProvider } from "./identity-provider.js";
import { requireDocumentUploads } from "../document/document-availability.middleware.js";

// KYC reviewers. Previously every one of these routes used the un-invoked
// `requireAuth` factory, which both hung the request AND — had it resolved —
// would have let any signed-in bidder approve their own KYC.
const REVIEWERS = ["compliance_officer", "org_admin", "super_admin"] as const;

export function createVerificationRouter(identityProvider?: IdentityVerificationProvider): Router {
  const router = Router();
  const controller = createVerificationController(new VerificationService(identityProvider));

  router.post(
    "/submit",
    requireAuth(),
    requireDocumentUploads,
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

  return router;
}

export default createVerificationRouter();
