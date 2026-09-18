import type { RequestHandler } from "express";
import { env } from "../../config/env.js";
import { sha256Hex } from "../../kernel/crypto.js";
import { AppError, HttpStatus } from "../errors/index.js";
import type { AuthenticatedRequest } from "../types/request.js";
import {
  findIdempotency,
  upsertIdempotency,
} from "../../infrastructure/idempotency/idempotency.repository.js";
import {
  buildIdempotencyKey,
  getIdempotentResponse,
  setIdempotentReplay,
} from "../utils/idempotency.js";

export function idempotencyMiddleware(options?: { required?: boolean }): RequestHandler {
  return (req, res, next) => {
    if (!["POST", "PUT", "PATCH"].includes(req.method)) {
      next();
      return;
    }

    const header = req.header("Idempotency-Key");
    if (!header) {
      if (options?.required) {
        next(new AppError("Idempotency-Key is required", HttpStatus.BAD_REQUEST, "IDEMPOTENCY_KEY_REQUIRED"));
        return;
      }
      next();
      return;
    }

    const auth = (req as AuthenticatedRequest).auth;
    if (!auth) {
      next();
      return;
    }

    const requestHash = sha256Hex(`${req.method}:${req.originalUrl}:${JSON.stringify(req.body ?? {})}`);
    const memoryKey = buildIdempotencyKey([req.method, req.originalUrl, auth.userId, header]);

    void (async () => {
      const stored = await findIdempotency(auth.userId, header).catch(() => {
        const cached = getIdempotentResponse(memoryKey);
        return cached
          ? { requestHash, statusCode: cached.statusCode, response: cached.payload }
          : null;
      });

      if (stored) {
        if (stored.requestHash !== requestHash && stored.requestHash !== "pending") {
          next(new AppError("Idempotency key reused with a different payload", HttpStatus.CONFLICT));
          return;
        }
        res.status(stored.statusCode).json(stored.response);
        return;
      }

      const originalJson = res.json.bind(res);
      res.json = ((body: unknown) => {
        if (res.statusCode < 500) {
          setIdempotentReplay(memoryKey, body, res.statusCode);
          void upsertIdempotency({
            userId: auth.userId,
            key: header,
            method: req.method,
            path: req.originalUrl,
            requestHash,
            statusCode: res.statusCode,
            response: body,
            ttlMs: env.IDEMPOTENCY_TTL_MS,
          }).catch(() => undefined);
        }
        return originalJson(body);
      }) as typeof res.json;

      next();
    })().catch(next);
  };
}
