import { z } from "zod";
import { ACCOUNT_TYPES } from "../enums.js";

export const RegisterRequest = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(1).max(150),
  phone: z.string().min(5).max(20).optional(),
  accountType: z.enum(ACCOUNT_TYPES).default("individual"),
  businessName: z.string().min(1).max(200).optional(),
  nationalId: z.string().min(4).max(30).optional(),
  tinNumber: z.string().min(4).max(20).optional(),
  region: z.string().min(1).max(80).optional(),
}).superRefine((data, ctx) => {
  if (data.accountType === "business") {
    if (!data.businessName) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Business name is required for business accounts", path: ["businessName"] });
    }
    if (!data.tinNumber) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "TIN number is required for business accounts", path: ["tinNumber"] });
    }
  }
});

export type RegisterRequest = z.infer<typeof RegisterRequest>;

export const LoginRequest = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type LoginRequest = z.infer<typeof LoginRequest>;

export const RefreshTokenRequest = z.object({
  refreshToken: z.string().min(10),
});
export type RefreshTokenRequest = z.infer<typeof RefreshTokenRequest>;

export const PasswordResetRequest = z.object({
  email: z.string().email(),
});
export type PasswordResetRequest = z.infer<typeof PasswordResetRequest>;

export const PasswordResetConfirm = z.object({
  token: z.string().min(20).max(200),
  password: z.string().min(8),
});
export type PasswordResetConfirm = z.infer<typeof PasswordResetConfirm>;
