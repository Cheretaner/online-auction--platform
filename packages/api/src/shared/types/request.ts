import type { Request } from "express";
import type { Role } from "@auction/shared";

export interface AuthContext {
  userId: string;
  organizationId?: string;
  roles: Role[];
}

export interface AuthenticatedRequest extends Request {
  auth?: AuthContext;
}

export function routeParam(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}
