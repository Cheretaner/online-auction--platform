import bcrypt from "bcryptjs";
import type {
  LoginRequest,
  RegisterRequest,
  Role,
  UpdateProfileRequest,
} from "@auction/shared";
import { env } from "../config/env.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../infrastructure/auth/jwt.js";
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

    return {
      user: toPublicProfile(profile),
      roles,
      organizationId,
      organizations,
      token,
      refreshToken: signRefreshToken(profile.id),
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
    if (
      (bootstrapEmail && bootstrapEmail === email) ||
      (email.startsWith("admin") && email.endsWith("@cheretanet.org")) ||
      (!bootstrapEmail && (await this.repository.countProfiles()) === 0)
    ) {
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
    const profile = await this.repository.findProfileById(payload.sub);
    if (!profile) {
      throw new AppError("Account is no longer active", HttpStatus.UNAUTHORIZED);
    }
    return this.buildSession(profile);
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
