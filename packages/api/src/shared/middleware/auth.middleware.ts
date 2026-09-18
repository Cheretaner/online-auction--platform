import type { RequestHandler } from "express";
import type { Role } from "@auction/shared";
import { verifyAccessToken } from "../../infrastructure/auth/jwt.js";
import { AppError, HttpStatus } from "../errors/index.js";
import type { AuthenticatedRequest } from "../types/request.js";

function readBearerToken(header: string | undefined): string | null {
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
}

function attachAuth(req: AuthenticatedRequest, token: string): void {
  const payload = verifyAccessToken(token);
  req.auth = {
    userId: payload.sub,
    organizationId: payload.organizationId,
    roles: payload.roles,
  };
}

export function optionalAuth(): RequestHandler {
  return (req, _res, next) => {
    const token = readBearerToken(req.headers.authorization);
    if (!token) {
      next();
      return;
    }
    try {
      attachAuth(req as AuthenticatedRequest, token);
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireAuth(roles?: Role[]): RequestHandler {
  return (req, _res, next) => {
    const token = readBearerToken(req.headers.authorization);
    if (!token) {
      next(new AppError("Missing or invalid authorization header", HttpStatus.UNAUTHORIZED));
      return;
    }

    try {
      attachAuth(req as AuthenticatedRequest, token);
      const auth = (req as AuthenticatedRequest).auth!;
      if (roles?.length && !roles.some((role) => auth.roles.includes(role))) {
        next(new AppError("Forbidden", HttpStatus.FORBIDDEN));
        return;
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireOrganization(): RequestHandler {
  return (req, _res, next) => {
    const organizationId = (req as AuthenticatedRequest).auth?.organizationId;
    if (!organizationId) {
      next(new AppError("Organization context required", HttpStatus.FORBIDDEN));
      return;
    }
    next();
  };
}
