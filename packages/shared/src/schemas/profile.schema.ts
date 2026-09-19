import { z } from "zod";
import { ACCOUNT_TYPES, VERIFICATION_STATUS } from "../enums.js";

export const UpdateProfileRequest = z.object({
  fullName: z.string().min(1).max(150).optional(),
  phone: z.string().min(5).max(20).optional(),
  region: z.string().min(1).max(80).optional(),
});

export type UpdateProfileRequest = z.infer<typeof UpdateProfileRequest>;

export const ProfileResponse = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  fullName: z.string(),
  phone: z.string().nullable(),
  accountType: z.enum(ACCOUNT_TYPES),
  businessName: z.string().nullable(),
  nationalId: z.string().nullable(),
  tinNumber: z.string().nullable(),
  region: z.string().nullable(),
  verificationStatus: z.enum(VERIFICATION_STATUS),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type ProfileResponse = z.infer<typeof ProfileResponse>;
