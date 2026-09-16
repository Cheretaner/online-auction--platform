import type { Request } from "express";
import type { Role } from "@auction/shared";
import { AppError, HttpStatus } from "../errors/index.js";

export interface AuthContext {
  userId: string;
  organizationId?: string;
  roles: Role[];
}

export interface AuthenticatedRequest extends Request {
  auth?: AuthContext;
}

export function routeParam(value: string | string[] | undefined): string {
  if (!value) {
    throw new AppError("Missing route parameter", HttpStatus.BAD_REQUEST);
  }
  return Array.isArray(value) ? value[0] : value;
}

export function getAuth(req: Request): AuthContext {
  const auth = (req as AuthenticatedRequest).auth;
  if (!auth) {
    throw new AppError("Unauthorized", HttpStatus.UNAUTHORIZED);
  }
  return auth;
}
