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

/** Signs a refresh token. `jti` identifies it in the refresh_tokens table,
 * which is what makes it revocable and single-use. */
export function signRefreshToken(userId: string, jti: string = randomUUID()): { token: string; jti: string; expiresAt: Date } {
  const token = jwt.sign({ sub: userId, jti, typ: "refresh" }, refreshSecret(), {
    ...signOptions,
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  });
  const { exp } = jwt.decode(token) as { exp: number };
  return { token, jti, expiresAt: new Date(exp * 1000) };
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

/** Reads an expired-but-genuine refresh token's ids, for logout only. The
 * signature is still checked; only the expiry is ignored. */
export function decodeRefreshTokenUnverified(token: string): { sub: string; jti: string } | null {
  try {
    const payload = jwt.verify(token, refreshSecret(), { ...signOptions, ignoreExpiration: true }) as RefreshTokenPayload;
    return payload.typ === "refresh" && payload.sub && payload.jti ? { sub: payload.sub, jti: payload.jti } : null;
  } catch {
    return null;
  }
}
