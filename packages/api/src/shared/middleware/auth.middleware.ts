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

/**
 * Attaches auth when a bearer token is present and valid, and silently
 * continues when it is absent. Used for public discovery endpoints that
 * enrich their response for signed-in callers.
 */
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
    } catch {
      // A bad token on an optional-auth route is treated as "anonymous"
      // rather than an error, so a stale token in a browser tab does not
      // break public browsing.
      next();
    }
  };
}

/**
 * Requires a valid bearer token, and optionally that the caller holds at
 * least one of `roles`.
 *
 * This is a FACTORY: always call it, e.g. `requireAuth()` or
 * `requireAuth(["org_admin"])`. Passing the bare function reference to
 * Express registers a middleware that returns a handler and never calls
 * `next()`, which hangs the request until the client times out.
 */
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
        next(new AppError("Forbidden", HttpStatus.FORBIDDEN, "FORBIDDEN"));
        return;
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Requires that the caller's token carries an organization context. Tokens
 * get one at login when the user is a member of exactly one organization,
 * or when they select one via `POST /api/v1/auth/context`.
 */
export function requireOrganization(): RequestHandler {
  return (req, _res, next) => {
    const organizationId = (req as AuthenticatedRequest).auth?.organizationId;
    if (!organizationId) {
      next(
        new AppError(
          "Organization context required. Select an organization via POST /api/v1/auth/context.",
          HttpStatus.FORBIDDEN,
          "ORG_CONTEXT_REQUIRED",
        ),
      );
      return;
    }
    next();
  };
}
