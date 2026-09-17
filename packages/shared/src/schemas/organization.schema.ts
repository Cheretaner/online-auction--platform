import { z } from "zod";
import { ORG_TYPES } from "../enums.js";

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
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Organization = z.infer<typeof Organization>;