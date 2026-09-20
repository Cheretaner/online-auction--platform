import { z } from "zod";
import { ORG_TYPES, OFFICER_ROLES } from "../enums.js";

export const CreateOrganizationRequest = z.object({
  name: z.string().min(2).max(200),
  orgType: z.enum(ORG_TYPES),
  tinNumber: z.string().min(4).max(20),
  region: z.string().min(1).max(80),
  contactEmail: z.string().email(),
  contactPhone: z.string().min(5).max(20),
});
export type CreateOrganizationRequest = z.infer<typeof CreateOrganizationRequest>;

export const Organization = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  orgType: z.enum(ORG_TYPES),
  tinNumber: z.string(),
  region: z.string(),
  contactEmail: z.string().email(),
  contactPhone: z.string(),
  logoUrl: z.string().url().nullable().optional(),
  isActive: z.boolean(),
  onboardedBy: z.string().uuid().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Organization = z.infer<typeof Organization>;

export const AddOrganizationMemberRequest = z.object({
  userId: z.string().uuid().optional(),
  email: z.string().email().optional(),
  role: z.enum(OFFICER_ROLES),
}).superRefine((data, ctx) => {
  if (!data.userId && !data.email) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Either userId or email is required",
      path: ["userId"],
    });
  }
});
export type AddOrganizationMemberRequest = z.infer<typeof AddOrganizationMemberRequest>;
