import type { RequestHandler } from "express";
import type { Role } from "@auction/shared";
import { verifyAccessToken } from "../../infrastructure/auth/jwt.js";
import { AppError, HttpStatus } from "../errors/index.js";
import type { AuthenticatedRequest } from "../types/request.js";

export function requireAuth(roles?: Role[]): RequestHandler {
  return (req, _res, next) => {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      next(new AppError("Missing or invalid authorization header", HttpStatus.UNAUTHORIZED));
      return;
    }

    try {
      const token = header.slice("Bearer ".length);
      const payload = verifyAccessToken(token);
      (req as AuthenticatedRequest).auth = {
        userId: payload.sub,
        organizationId: payload.organizationId,
        roles: payload.roles,
      };

      if (roles?.length && !roles.some((role) => payload.roles.includes(role))) {
        next(new AppError("Forbidden", HttpStatus.FORBIDDEN));
        return;
      }

      next();
    } catch {
      next(new AppError("Invalid or expired token", HttpStatus.UNAUTHORIZED));
    }
  };
}
