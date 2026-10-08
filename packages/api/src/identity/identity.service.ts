import { createHash, randomBytes, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import type {
  CreateUserRequest,
  LoginRequest,
  RegisterRequest,
  Role,
  UpdateProfileRequest,
  UpdateUserRequest,
} from "@auction/shared";
import { env } from "../config/env.js";
import {
  decodeRefreshTokenUnverified,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../infrastructure/auth/jwt.js";
import { isUniqueViolation } from "../kernel/pg.js";
import { AppError, HttpStatus } from "../shared/errors/index.js";
import { mailAdapter } from "../infrastructure/mail/mail.adapter.js";
import { logger } from "../shared/utils/logger.js";
import { IdentityRepository } from "./identity.repository.js";
import * as sessions from "./session.repository.js";
import type { AuthSession, Profile, PublicProfile } from "./identity.types.js";
import type { GoogleIdentity } from "./google-token.js";

const BCRYPT_ROUNDS = 12;
const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function toPublicProfile(profile: Profile): PublicProfile {
  const { passwordHash: _passwordHash, nationalId: _nationalId, tinNumber: _tinNumber, ...rest } = profile;
  return rest;
}

async function bootstrapPlatformRole(email: string, repository: IdentityRepository): Promise<Role | null> {
  const bootstrapEmail = env.BOOTSTRAP_SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  if (bootstrapEmail) return bootstrapEmail === email ? "super_admin" : null;
  if (env.NODE_ENV !== "production" && (await repository.countProfiles()) === 0) return "super_admin";
  return null;
}

export class IdentityService {
  private repository = new IdentityRepository();

  /**
   * Builds the session payload returned by register/login/context-switch.
   *
   * `organizationId` is embedded in the access token because every
   * organization-scoped service (auction creation, approval, compliance)
   * reads it from the token, and because withTransaction() forwards it to
   * `app.current_org_id` for row-level security. When the user belongs to
   * exactly one organization it is selected automatically; otherwise the
   * caller picks one via POST /api/v1/auth/context.
   */
  private async issueSession(
    profile: Profile,
    preferredOrgId?: string,
    familyId: string = randomUUID(),
  ): Promise<AuthSession & { refreshJti: string }> {
    const [roles, organizations] = await Promise.all([
      this.repository.findUserRoles(profile.id),
      this.repository.findMemberships(profile.id),
    ]);

    let organizationId: string | null = null;
    if (preferredOrgId) {
      const match = organizations.find((org) => org.organizationId === preferredOrgId);
      if (!match) {
        throw new AppError("You are not a member of that organization", HttpStatus.FORBIDDEN);
      }
      organizationId = match.organizationId;
    } else if (organizations.length === 1) {
      organizationId = organizations[0].organizationId;
    }

    const token = signAccessToken({
      sub: profile.id,
      roles,
      organizationId: organizationId ?? undefined,
    });

    // Every login starts a new refresh-token family; a refresh continues it.
    const refresh = signRefreshToken(profile.id);
    await sessions.recordRefreshToken({
      jti: refresh.jti,
      userId: profile.id,
      familyId,
      expiresAt: refresh.expiresAt,
    });

    return {
      user: toPublicProfile(profile),
      roles,
      organizationId,
      organizations,
      token,
      refreshToken: refresh.token,
      refreshJti: refresh.jti,
      expiresIn: env.JWT_EXPIRES_IN,
    };
  }

  private async buildSession(profile: Profile, preferredOrgId?: string): Promise<AuthSession> {
    const { refreshJti: _refreshJti, ...session } = await this.issueSession(profile, preferredOrgId);
    return session;
  }

  async register(data: RegisterRequest): Promise<AuthSession> {
    const email = data.email.trim().toLowerCase();
    const existing = await this.repository.findProfileByEmail(email);
    if (existing) {
      throw new AppError("Email already in use", HttpStatus.CONFLICT);
    }

    // Only the configured bootstrap address may become super_admin at
    // sign-up. Registration has no email verification, so any rule based on
    // the shape of the address lets anyone claim the role. The "first
    // account wins" fallback is for local development only; production
    // requires BOOTSTRAP_SUPER_ADMIN_EMAIL (see config/env.ts).
    const platformRole = await bootstrapPlatformRole(email, this.repository);

    const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);

    let profile: Profile;
    try {
      profile = await this.repository.createProfile({
        email,
        fullName: data.fullName,
        passwordHash,
        phone: data.phone,
        accountType: data.accountType,
        businessName: data.businessName,
        nationalId: data.nationalId,
        tinNumber: data.tinNumber,
        region: data.region,
        platformRole,
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new AppError("Email already in use", HttpStatus.CONFLICT);
      }
      throw error;
    }

    return this.buildSession(profile);
  }

  async loginWithGoogle(identity: GoogleIdentity): Promise<AuthSession> {
    const email = identity.email.trim().toLowerCase();
    const existingGoogleProfile = await this.repository.findProfileByGoogleSubject(identity.subject);
    if (existingGoogleProfile) return this.buildSession(existingGoogleProfile);

    const existingEmailProfile = await this.repository.findProfileByEmail(email);
    if (existingEmailProfile) {
      let linkedProfile: Profile | null;
      try {
        linkedProfile = await this.repository.linkGoogleSubject(existingEmailProfile.id, identity.subject);
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
        linkedProfile = null;
      }
      if (linkedProfile) return this.buildSession(linkedProfile);

      const concurrentlyLinkedProfile = await this.repository.findProfileByGoogleSubject(identity.subject);
      if (concurrentlyLinkedProfile) return this.buildSession(concurrentlyLinkedProfile);
      throw AppError.conflict("This email is already linked to a different Google account");
    }

    const passwordHash = await bcrypt.hash(randomBytes(32).toString("base64url"), BCRYPT_ROUNDS);
    try {
      const profile = await this.repository.createProfile({
        email,
        fullName: identity.name?.trim() || email.split("@")[0],
        passwordHash,
        accountType: "individual",
        platformRole: await bootstrapPlatformRole(email, this.repository),
        googleSubject: identity.subject,
      });
      return this.buildSession(profile);
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;

      const concurrentlyCreatedProfile = await this.repository.findProfileByGoogleSubject(identity.subject);
      if (concurrentlyCreatedProfile) return this.buildSession(concurrentlyCreatedProfile);

      const concurrentlyRegisteredProfile = await this.repository.findProfileByEmail(email);
      if (concurrentlyRegisteredProfile) {
        let linkedProfile: Profile | null;
        try {
          linkedProfile = await this.repository.linkGoogleSubject(concurrentlyRegisteredProfile.id, identity.subject);
        } catch (linkError) {
          if (!isUniqueViolation(linkError)) throw linkError;
          linkedProfile = null;
        }
        if (linkedProfile) return this.buildSession(linkedProfile);
      }
      throw AppError.conflict("An account already exists with this email");
    }
  }

  async login(data: LoginRequest): Promise<AuthSession> {
    const profile = await this.repository.findProfileByEmail(data.email);

  
    const hash = profile?.passwordHash ?? "$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidiu";
    const isValid = await bcrypt.compare(data.password, hash);

    if (!profile || !isValid) {
      throw new AppError("Invalid credentials", HttpStatus.UNAUTHORIZED);
    }

    return this.buildSession(profile);
  }

  /**
   * Exchanges a refresh token for a new session. Refresh tokens are
   * single-use: the presented one is revoked and a successor in the same
   * family is issued. Presenting a token that was already used (outside a
   * short multi-tab grace window) means it leaked, so every session in its
   * family is revoked and the user has to sign in again.
   */
  async refresh(refreshToken: string): Promise<AuthSession> {
    const payload = verifyRefreshToken(refreshToken);
    const result = await sessions.consumeRefreshToken(payload.jti, payload.sub);

    if (result.status === "reused") {
      await sessions.revokeFamily(result.familyId);
      throw new AppError("Session is no longer valid, please sign in again", HttpStatus.UNAUTHORIZED, "REFRESH_TOKEN_REUSED");
    }
    if (result.status !== "ok") {
      throw new AppError("Session is no longer valid, please sign in again", HttpStatus.UNAUTHORIZED, "REFRESH_TOKEN_INVALID");
    }

    const profile = await this.repository.findProfileById(payload.sub);
    if (!profile) {
      await sessions.revokeFamily(result.familyId);
      throw new AppError("Account is no longer active", HttpStatus.UNAUTHORIZED);
    }
    const { refreshJti, ...session } = await this.issueSession(profile, undefined, result.familyId);
    await sessions.markReplaced(payload.jti, refreshJti);
    return session;
  }

  /** Ends the session the refresh token belongs to (all tokens in its family).
   * Accepts an expired token so a user can always log out; an invalid one is
   * ignored because there is nothing to revoke. */
  async logout(refreshToken: string): Promise<void> {
    let payload: { sub: string; jti: string };
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      const decoded = decodeRefreshTokenUnverified(refreshToken);
      if (!decoded) return;
      payload = decoded;
    }
    await sessions.revokeFamilyOf(payload.jti, payload.sub);
  }

  /**
   * Emails a single-use reset link. Always resolves the same way whether or
   * not the address has an account, so the endpoint cannot be used to find
   * out who is registered.
   */
  async requestPasswordReset(email: string): Promise<void> {
    const profile = await this.repository.findProfileByEmail(email.trim().toLowerCase());
    if (!profile) return;

    const token = randomBytes(32).toString("base64url");
    await sessions.createPasswordReset(profile.id, hashResetToken(token), new Date(Date.now() + RESET_TOKEN_TTL_MS));

    const link = `${env.WEB_BASE_URL.replace(/\/$/, "")}/reset-password?token=${token}`;
    try {
      await mailAdapter.send({
        to: profile.email,
        subject: "Reset your Cheretanet password",
        body: [
          `Hello ${profile.fullName},`,
          "",
          "Someone asked to reset the password for your Cheretanet account.",
          `Open this link within 30 minutes to choose a new password:`,
          link,
          "",
          "If you did not ask for this, ignore this email. Your password stays the same.",
        ].join("\n"),
      });
    } catch (error) {
      logger.error({ err: error, userId: profile.id }, "Password reset email could not be sent");
    }
  }

  /** Sets a new password from a reset link and signs the user out everywhere. */
  async confirmPasswordReset(token: string, password: string): Promise<void> {
    const userId = await sessions.consumePasswordReset(hashResetToken(token));
    if (!userId) {
      throw new AppError("This reset link is invalid or has expired", HttpStatus.BAD_REQUEST, "RESET_TOKEN_INVALID");
    }
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    await this.repository.updatePasswordHash(userId, passwordHash);
    await sessions.revokeAllForUser(userId);
  }

  async switchOrganization(userId: string, organizationId: string): Promise<AuthSession> {
    const profile = await this.repository.findProfileById(userId);
    if (!profile) throw new AppError("Profile not found", HttpStatus.NOT_FOUND);
    return this.buildSession(profile, organizationId);
  }

  async getProfile(userId: string): Promise<PublicProfile & { roles: Role[] }> {
    const profile = await this.repository.findProfileById(userId);
    if (!profile) {
      throw new AppError("Profile not found", HttpStatus.NOT_FOUND);
    }
    const roles = await this.repository.findUserRoles(userId);
    return { ...toPublicProfile(profile), roles };
  }

  async updateProfile(userId: string, data: UpdateProfileRequest): Promise<PublicProfile> {
    const profile = await this.repository.updateProfile(userId, data);
    if (!profile) {
      throw new AppError("Profile not found", HttpStatus.NOT_FOUND);
    }
    return toPublicProfile(profile);
  }

  async listUsers(): Promise<Array<PublicProfile & { roles: Role[] }>> {
    return this.repository.listAdminUsers();
  }

  async createUser(data: CreateUserRequest, actor: { userId: string; roles: Role[] }): Promise<PublicProfile> {
    const email = data.email.trim().toLowerCase();
    if (await this.repository.findProfileByEmail(email)) {
      throw new AppError("Email already in use", HttpStatus.CONFLICT);
    }
    const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);
    const profile = await this.repository.createProfile({
      email,
      fullName: data.fullName,
      passwordHash,
      accountType: "individual",
      platformRole: data.platformRole ?? null,
    });
    return toPublicProfile(profile);
  }

  async updateUser(
    id: string,
    data: UpdateUserRequest,
    actor: { userId: string; roles: Role[] },
  ): Promise<PublicProfile> {
    const profile = await this.repository.updatePlatformProfile(id, {
      fullName: data.fullName,
      isActive: data.isActive,
      platformRole: data.platformRole,
    });
    if (!profile) throw new AppError("User not found", HttpStatus.NOT_FOUND);
    return toPublicProfile(profile);
  }

  async deactivateUser(id: string, actor: { userId: string; roles: Role[] }): Promise<void> {
    const profile = await this.repository.findProfileById(id);
    if (!profile) throw new AppError("User not found", HttpStatus.NOT_FOUND);
    if (profile.id === actor.userId) {
      throw new AppError("You cannot deactivate your own account", HttpStatus.CONFLICT);
    }
    if (profile.platformRole === "super_admin") {
      const count = await this.repository.countSuperAdmins();
      if (count <= 1) throw new AppError("At least one active super admin is required", HttpStatus.UNPROCESSABLE);
    }
    await this.repository.deactivateProfile(id);
  }
}
