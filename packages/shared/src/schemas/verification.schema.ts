import { z } from "zod";
import { VERIFICATION_DECISIONS, VERIFICATION_DOCUMENT_TYPES, VERIFICATION_STATUS } from "../enums.js";

const documentFields = z.object({
  documentType: z.enum(VERIFICATION_DOCUMENT_TYPES),
  documentNumber: z.string().trim().min(1).max(100),
});

function validateDocumentNumber(
  data: z.infer<typeof documentFields>,
  ctx: z.RefinementCtx,
): void {
  const normalized = data.documentNumber.replace(/[\s-]/g, "");
  if (data.documentType === "national_id" && !/^\d{12}$/.test(normalized)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Fayda numbers contain 12 digits", path: ["documentNumber"] });
  }
  if (data.documentType === "kebele_id" && !/^[A-Za-z0-9/.-]{4,30}$/.test(normalized)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Enter a valid kebele ID number", path: ["documentNumber"] });
  }
  if (data.documentType === "passport" && !/^[A-Za-z0-9]{6,12}$/.test(normalized)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Enter a valid passport number", path: ["documentNumber"] });
  }
}

export const VerificationDocumentFields = documentFields.superRefine(validateDocumentNumber);

export const SubmitVerificationRequest = documentFields.extend({
  documentId: z.string().uuid(),
}).superRefine(validateDocumentNumber);

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
  documentId: z.string().uuid().nullable(),
  status: z.enum(VERIFICATION_STATUS),
  decision: z.enum(VERIFICATION_DECISIONS).nullable(),
  decisionReason: z.string().nullable(),
  reviewedBy: z.string().uuid().nullable(),
  reviewedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type VerificationResponse = z.infer<typeof VerificationResponse>;
