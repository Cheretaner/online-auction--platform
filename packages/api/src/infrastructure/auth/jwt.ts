import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import type { Role } from "@auction/shared";
import { env } from "../../config/env.js";
import { AppError, HttpStatus } from "../../shared/errors/index.js";

export interface AccessTokenPayload {
  sub: string;
  organizationId?: string;
  roles: Role[];
  typ: "access";
}

export interface RefreshTokenPayload {
  sub: string;
  jti: string;
  typ: "refresh";
}

const signOptions = {
  issuer: env.JWT_ISSUER,
  audience: env.JWT_AUDIENCE,
} satisfies jwt.SignOptions;

function refreshSecret(): string {
  return env.JWT_REFRESH_SECRET ?? `${env.JWT_SECRET}-refresh`;
}

export function signAccessToken(
  payload: Omit<AccessTokenPayload, "typ">,
): string {
  return jwt.sign({ ...payload, typ: "access" }, env.JWT_SECRET, {
    ...signOptions,
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  });
}

export function signRefreshToken(userId: string): string {
  return jwt.sign({ sub: userId, jti: randomUUID(), typ: "refresh" }, refreshSecret(), {
    ...signOptions,
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET, signOptions) as AccessTokenPayload;
    if ((payload.typ && payload.typ !== "access") || !payload.sub || !Array.isArray(payload.roles)) {
      throw new AppError("Invalid access token", HttpStatus.UNAUTHORIZED);
    }
    return payload;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError("Invalid or expired token", HttpStatus.UNAUTHORIZED);
  }
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  try {
    const payload = jwt.verify(token, refreshSecret(), signOptions) as RefreshTokenPayload;
    if (payload.typ !== "refresh" || !payload.sub || !payload.jti) {
      throw new AppError("Invalid refresh token", HttpStatus.UNAUTHORIZED);
    }
    return payload;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError("Invalid or expired refresh token", HttpStatus.UNAUTHORIZED);
  }
}
