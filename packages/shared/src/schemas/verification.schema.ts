import { z } from "zod";
import { VERIFICATION_DECISIONS, VERIFICATION_STATUS } from "../enums.js";

export const SubmitVerificationRequest = z.object({
  documentType: z.string().min(1).max(100),
  documentNumber: z.string().min(1).max(100),
});

export type SubmitVerificationRequest = z.infer<typeof SubmitVerificationRequest>;

export const ReviewVerificationRequest = z.object({
  decision: z.enum(VERIFICATION_DECISIONS),
  decisionReason: z.string().min(1).max(2000).optional(),
}).superRefine((data, ctx) => {
  if (data.decision === "rejected" && !data.decisionReason) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Decision reason is required when rejecting", path: ["decisionReason"] });
  }
});

export type ReviewVerificationRequest = z.infer<typeof ReviewVerificationRequest>;

export const VerificationResponse = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  documentType: z.string(),
  documentNumber: z.string(),
  status: z.enum(VERIFICATION_STATUS),
  decision: z.enum(VERIFICATION_DECISIONS).nullable(),
  decisionReason: z.string().nullable(),
  reviewedBy: z.string().uuid().nullable(),
  reviewedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type VerificationResponse = z.infer<typeof VerificationResponse>;
