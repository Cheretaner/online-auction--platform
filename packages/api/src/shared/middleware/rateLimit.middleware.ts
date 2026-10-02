import rateLimit, { type Options } from "express-rate-limit";
import { env } from "../../config/env.js";
import { getAuth } from "../types/request.js";

export function createRateLimiter(overrides: Partial<Options> = {}) {
  return rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    limit: env.RATE_LIMIT_MAX,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    skip: (req) => req.path.startsWith("/health"),
    message: { error: { message: "Too many requests" } },
    ...overrides,
  });
}

export const apiRateLimiter = createRateLimiter();

/**
 * Tight bucket for credential endpoints (register/login/refresh). Keyed by
 * IP so one client cannot brute-force passwords under the much larger
 * global allowance. Successful requests still count, which is deliberate:
 * it also caps automated account creation.
 */
export const authRateLimiter = createRateLimiter({
  limit: env.AUTH_RATE_LIMIT_MAX,
  skip: () => false,
  message: { error: { message: "Too many authentication attempts, please retry shortly" } },
});

export const submissionRateLimiter = createRateLimiter({
  windowMs: env.SUBMISSION_RATE_WINDOW_MS,
  limit: env.SUBMISSION_RATE_LIMIT_MAX,
  keyGenerator: (req) => getAuth(req).userId,
  message: { error: { message: "Too many submissions. Please wait before trying again." } },
});
