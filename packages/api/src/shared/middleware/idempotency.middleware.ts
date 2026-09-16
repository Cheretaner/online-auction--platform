import type { RequestHandler } from "express";
import {
  buildIdempotencyKey,
  getIdempotentResponse,
  setIdempotentReplay,
} from "../utils/idempotency.js";
import type { AuthenticatedRequest } from "../types/request.js";

export function idempotencyMiddleware(): RequestHandler {
  return (req, res, next) => {
    if (!["POST", "PUT", "PATCH"].includes(req.method)) {
      next();
      return;
    }

    const header = req.header("Idempotency-Key");
    if (!header) {
      next();
      return;
    }

    const auth = (req as AuthenticatedRequest).auth;
    const key = buildIdempotencyKey([req.method, req.originalUrl, auth?.userId, header]);
    const cached = getIdempotentResponse(key);
    if (cached) {
      res.status(cached.statusCode).json(cached.payload);
      return;
    }

    const originalJson = res.json.bind(res);
    res.json = ((body: unknown) => {
      if (res.statusCode < 500) {
        setIdempotentReplay(key, body, res.statusCode);
      }
      return originalJson(body);
    }) as typeof res.json;

    next();
  };
}
