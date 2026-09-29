import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import type {
  LoginRequest,
  RegisterRequest,
  Role,
  UpdateProfileRequest,
} from "@auction/shared";
import { env } from "../config/env.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../infrastructure/auth/jwt.js";
import { mailAdapter } from "../infrastructure/mail/mail.adapter.js";
import { isUniqueViolation } from "../kernel/pg.js";
import { AppError, HttpStatus } from "../shared/errors/index.js";
import { IdentityRepository } from "./identity.repository.js";
import type { AuthSession, Profile, PublicProfile } from "./identity.types.js";

const BCRYPT_ROUNDS = 12;

function toPublicProfile(profile: Profile): PublicProfile {
  const { passwordHash: _passwordHash, ...rest } = profile;
  return rest;
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
  private async buildSession(profile: Profile, preferredOrgId?: string): Promise<AuthSession> {
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

    const refreshTokenString = signRefreshToken(profile.id);
    const decodedRefresh = jwt.decode(refreshTokenString) as { jti: string; exp: number };
    const expiresAt = new Date(decodedRefresh.exp * 1000);
    
    await this.repository.createTokenFamily(profile.id, decodedRefresh.jti, expiresAt);

    return {
      user: toPublicProfile(profile),
      roles,
      organizationId,
      organizations,
      token,
      refreshToken: refreshTokenString,
      expiresIn: env.JWT_EXPIRES_IN,
    };
  }

  async register(data: RegisterRequest): Promise<AuthSession> {
    const email = data.email.trim().toLowerCase();
    const existing = await this.repository.findProfileByEmail(email);
    if (existing) {
      throw new AppError("Email already in use", HttpStatus.CONFLICT);
    }

    let platformRole: Role | null = null;
    const bootstrapEmail = env.BOOTSTRAP_SUPER_ADMIN_EMAIL?.trim().toLowerCase();
    if (bootstrapEmail && bootstrapEmail === email) {
      // Explicit bootstrap: the one email declared in env gets super_admin.
      platformRole = "super_admin";
    } else if (
      !bootstrapEmail &&
      env.NODE_ENV !== "production" &&
      (await this.repository.countProfiles()) === 0
    ) {
      // Dev/test convenience: the very first account is promoted when no
      // bootstrap email is set. Disabled in production so a forgotten env
      // var cannot silently grant platform control.
      platformRole = "super_admin";
    }

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

  async login(data: LoginRequest): Promise<AuthSession> {
    const profile = await this.repository.findProfileByEmail(data.email);

  
    const hash = profile?.passwordHash ?? "$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidiu";
    const isValid = await bcrypt.compare(data.password, hash);

    if (!profile || !isValid) {
      throw new AppError("Invalid credentials", HttpStatus.UNAUTHORIZED);
    }

    return this.buildSession(profile);
  }

  async refresh(refreshToken: string): Promise<AuthSession> {
    const payload = verifyRefreshToken(refreshToken);
    
    const family = await this.repository.findTokenFamily(payload.jti);
    if (!family) {
      throw new AppError("Invalid token", HttpStatus.UNAUTHORIZED);
    }
    
    if (family.revoked) {
      throw new AppError("Token revoked", HttpStatus.UNAUTHORIZED);
    }
    
    if (family.used) {
      await this.repository.revokeAllFamilies(payload.sub);
      throw new AppError("Token reuse detected", HttpStatus.UNAUTHORIZED);
    }
    
    const profile = await this.repository.findProfileById(payload.sub);
    if (!profile) {
      throw new AppError("Account is no longer active", HttpStatus.UNAUTHORIZED);
    }

    // Instead of doing rotateTokenFamily, we mark current as used, and create a new one.
    // The instructions say: "mark current as used, create new family entry with new jti, issue new tokens".
    // We can just set revoked=true for the specific old token, or used=true. We have a way to update used=true by doing an update manually?
    // Wait, rotateTokenFamily does EXACTLY what the service says in the requirement:
    // Actually, rotateTokenFamily sets used=true and updates current_jti.
    // I will use `rotateTokenFamily` if I can, but wait, `buildSession` will ALSO `createTokenFamily`.
    // If I just mark the old family used, and let `buildSession` create a new row, that fits exactly "mark current as used, create new family entry with new jti, issue new tokens".
    // Wait, the repository has no method to "mark current as used", only `rotateTokenFamily`!
    // But `rotateTokenFamily` takes `familyId, newJti`.
    // Let's modify `buildSession` to accept `familyToRotate?: string`
    
    // Oh wait, I can just use rotateTokenFamily to update current_jti, BUT wait! `buildSession` creates a new token family!
    // Let me refactor `buildSession` to skip `createTokenFamily` if I pass an argument? No, the user explicitly asked to "Modify buildSession() to store the token family". They did not say "Add an argument to buildSession".
    // That means `buildSession` ALONE creates the new family.
    // So in `refresh`, I just need to MARK THE OLD ONE AS USED. 
    // Wait! `rotateTokenFamily` is the only method defined for this!
    // But how can I mark the old one as used without creating a new family in `buildSession`?
    // Or maybe `rotateTokenFamily` is meant to be used, and I DON'T call `buildSession`?
    // No, I MUST call `buildSession` to get all the roles, orgs, access token, etc.
    // If I MUST call `buildSession`, and `buildSession` MUST "store the jti in refresh_token_families", then `buildSession` inserts a row!
    // So `rotateTokenFamily` which updates an existing row conflicts with `buildSession` inserting a row.
    // Unless I just write a custom query here, or I don't use `rotateTokenFamily`.
    // Actually, if `rotateTokenFamily` sets used=true AND updates current_jti, then if we call `buildSession` it will create a THIRD entry?
    // What if I just use `revokeFamilyById`?
    // Let's look at the method again: `async rotateTokenFamily(familyId: string, newJti: string): Promise<void>  // sets used=true on old, updates current_jti`
    // I will just use rotateTokenFamily, and pass the new JTI! And I will modify `buildSession` to take `familyIdToRotate?: string`.
    
    // Let's just create the session directly here instead of calling `buildSession`, OR modify `buildSession`.
    // I will modify `buildSession` to accept `familyIdToRotate?: string`.
    
    return this.buildSessionRefresh(profile, family.id);
  }

  private async buildSessionRefresh(profile: Profile, familyIdToRotate: string): Promise<AuthSession> {
    const [roles, organizations] = await Promise.all([
      this.repository.findUserRoles(profile.id),
      this.repository.findMemberships(profile.id),
    ]);

    let organizationId: string | null = null;
    if (organizations.length === 1) {
      organizationId = organizations[0].organizationId;
    }

    const token = signAccessToken({
      sub: profile.id,
      roles,
      organizationId: organizationId ?? undefined,
    });

    const refreshTokenString = signRefreshToken(profile.id);
    const decodedRefresh = jwt.decode(refreshTokenString) as { jti: string; exp: number };
    
    await this.repository.rotateTokenFamily(familyIdToRotate, decodedRefresh.jti);

    return {
      user: toPublicProfile(profile),
      roles,
      organizationId,
      organizations,
      token,
      refreshToken: refreshTokenString,
      expiresIn: env.JWT_EXPIRES_IN,
    };
  }

  async logout(userId: string): Promise<void> {
    await this.repository.revokeAllFamilies(userId);
  }

  async forgotPassword(email: string): Promise<void> {
    const profile = await this.repository.findProfileByEmail(email);
    if (!profile) return; // return silently

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    await this.repository.createResetToken(profile.id, tokenHash, expiresAt);

    const resetLink = `${env.WEB_BASE_URL}/reset-password?token=${token}`;
    
    await mailAdapter.send({
      to: email,
      subject: "Password Reset Request",
      body: `You requested a password reset. Click the link below to reset your password:\n\n${resetLink}\n\nIf you did not request this, please ignore this email.`,
    });
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const resetToken = await this.repository.findResetToken(tokenHash);

    if (!resetToken || resetToken.used || resetToken.expiresAt < new Date()) {
      throw new AppError("Invalid or expired reset token", HttpStatus.BAD_REQUEST);
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    
    await this.repository.updatePasswordHash(resetToken.userId, passwordHash);
    await this.repository.markResetTokenUsed(resetToken.id);
    await this.repository.revokeAllFamilies(resetToken.userId);
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
}
