import bcrypt from "bcryptjs";
import { IdentityRepository } from "./identity.repository.js";
import { signAccessToken } from "../infrastructure/auth/jwt.js";
import { AppError, HttpStatus } from "../shared/errors/index.js";
import type { RegisterRequest, LoginRequest, UpdateProfileRequest, Role } from "@auction/shared";

export class IdentityService {
  private repository = new IdentityRepository();

  async register(data: RegisterRequest) {
    const existing = await this.repository.findProfileByEmail(data.email);
    if (existing) {
      throw new AppError("Email already in use", HttpStatus.CONFLICT);
    }

    const passwordHash = await bcrypt.hash(data.password, 10);
    const profile = await this.repository.createProfile({
      ...data,
      passwordHash,
    });

    const roles: Role[] = ['bidder'];
    const token = signAccessToken({ sub: profile.id, roles });

    const { passwordHash: _, ...userWithoutPassword } = profile;
    return { user: userWithoutPassword, token };
  }

  async login(data: LoginRequest) {
    const profile = await this.repository.findProfileByEmail(data.email);
    if (!profile) {
      throw new AppError("Invalid credentials", HttpStatus.UNAUTHORIZED);
    }

    const isValid = await bcrypt.compare(data.password, profile.passwordHash);
    if (!isValid) {
      throw new AppError("Invalid credentials", HttpStatus.UNAUTHORIZED);
    }

    const roles = await this.repository.findUserRoles(profile.id);
    const token = signAccessToken({ sub: profile.id, roles });

    const { passwordHash: _, ...userWithoutPassword } = profile;
    return { user: userWithoutPassword, token };
  }

  async getProfile(userId: string) {
    const profile = await this.repository.findProfileById(userId);
    if (!profile) {
      throw new AppError("Profile not found", HttpStatus.NOT_FOUND);
    }
    const { passwordHash: _, ...userWithoutPassword } = profile;
    return userWithoutPassword;
  }

  async updateProfile(userId: string, data: UpdateProfileRequest) {
    const profile = await this.repository.updateProfile(userId, data);
    const { passwordHash: _, ...userWithoutPassword } = profile;
    return userWithoutPassword;
  }
}
