import bcrypt from "bcryptjs";
import { LoginRequest, RegisterRequest } from "@auction/shared";
import { signAccessToken } from "../infrastructure/auth/jwt.js";
import { AppError, HttpStatus } from "../shared/errors/index.js";
import * as repo from "./identity.repository.js";
import type { AuthTokens } from "./identity.types.js";

export async function register(input: RegisterRequest): Promise<AuthTokens> {
  const existing = await repo.findUserByEmail(input.email);
  if (existing) {
    throw new AppError("Email already registered", HttpStatus.CONFLICT);
  }

  const passwordHash = await bcrypt.hash(input.password, 12);
  const user = await repo.createUser(input.email, passwordHash, input.displayName);
  const roles = await repo.getUserRoles(user.id);

  return {
    accessToken: signAccessToken({ sub: user.id, roles }),
    user: {
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      verified: user.verified,
      roles,
    },
  };
}

export async function login(input: LoginRequest): Promise<AuthTokens> {
  const user = await repo.findUserByEmail(input.email);
  if (!user) {
    throw new AppError("Invalid credentials", HttpStatus.UNAUTHORIZED);
  }

  const valid = await bcrypt.compare(input.password, user.password_hash);
  if (!valid) {
    throw new AppError("Invalid credentials", HttpStatus.UNAUTHORIZED);
  }

  const roles = await repo.getUserRoles(user.id);
  return {
    accessToken: signAccessToken({ sub: user.id, roles }),
    user: {
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      verified: user.verified,
      roles,
    },
  };
}
