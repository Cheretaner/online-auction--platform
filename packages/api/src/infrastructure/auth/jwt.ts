import jwt from "jsonwebtoken";
import type { Role } from "@auction/shared";
import { env } from "../../config/env.js";

export interface AccessTokenPayload {
  sub: string;
  organizationId?: string;
  roles: Role[];
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.JWT_SECRET) as AccessTokenPayload;
}
