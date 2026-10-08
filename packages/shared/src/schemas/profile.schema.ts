import { z } from "zod";
import { ACCOUNT_TYPES, VERIFICATION_STATUS, ROLES } from "../enums.js";

export const UpdateProfileRequest = z.object({
  fullName: z.string().min(1).max(150).optional(),
  phone: z.string().min(5).max(20).optional(),
  region: z.string().min(1).max(80).optional(),
  preferredLanguage: z.enum(["en", "am"]).optional(),
});

export type UpdateProfileRequest = z.infer<typeof UpdateProfileRequest>;

export const CreateUserRequest = z.object({
  email: z.string().email().max(320),
  password: z.string().min(8).max(256),
  fullName: z.string().min(2).max(150),
  platformRole: z.enum(ROLES).nullable().optional(),
  isActive: z.boolean().optional(),
});
export type CreateUserRequest = z.infer<typeof CreateUserRequest>;

export const UpdateUserRequest = z.object({
  fullName: z.string().min(2).max(150).optional(),
  isActive: z.boolean().optional(),
  platformRole: z.enum(ROLES).nullable().optional(),
}).refine((data) => Object.keys(data).length > 0, "At least one field is required");
export type UpdateUserRequest = z.infer<typeof UpdateUserRequest>;

export const ProfileResponse = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  fullName: z.string(),
  phone: z.string().nullable(),
  accountType: z.enum(ACCOUNT_TYPES),
  businessName: z.string().nullable(),
  region: z.string().nullable(),
  preferredLanguage: z.enum(["en", "am"]).nullable(),
  verificationStatus: z.enum(VERIFICATION_STATUS),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type ProfileResponse = z.infer<typeof ProfileResponse>;
