import rateLimit, { type Options } from "express-rate-limit";
import { env } from "../../config/env.js";

export function createRateLimiter(overrides: Partial<Options> = {}) {
  return rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    limit: env.RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.path.startsWith("/health"),
    message: { error: { message: "Too many requests" } },
    ...overrides,
  });
}

export const apiRateLimiter = createRateLimiter();
