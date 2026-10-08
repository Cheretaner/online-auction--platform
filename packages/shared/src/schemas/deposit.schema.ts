import { z } from "zod";
import { DEPOSIT_STATUS, DEPOSIT_INSTRUMENT_TYPES, ETHIOPIAN_BANKS } from "../enums.js";
import { Money } from "./money.js";

export const CreateDepositRequest = z.object({
  auctionId: z.string().uuid(),
  amount: Money,
  referenceNumber: z.string().trim().min(3).max(100).regex(/^[A-Za-z0-9][A-Za-z0-9./_-]*$/),
  issuingBank: z.enum(ETHIOPIAN_BANKS),
  instrumentType: z.enum(DEPOSIT_INSTRUMENT_TYPES),
  documentId: z.string().uuid().optional(),
}).superRefine((data, ctx) => {
  if (data.instrumentType === "cpo" && !data.documentId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["documentId"], message: "A scanned CPO proof is required" });
  }
});

export type CreateDepositRequest = z.infer<typeof CreateDepositRequest>;

export const InitiateChapaDepositRequest = z.object({
  auctionId: z.string().uuid(),
});
export type InitiateChapaDepositRequest = z.infer<typeof InitiateChapaDepositRequest>;

export const ReviewDepositRequest = z.object({
  decision: z.enum(["verified", "rejected"]),
  rejectionReason: z.string().min(1).max(1000).optional(),
}).superRefine((data, ctx) => {
  if (data.decision === "rejected" && !data.rejectionReason) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Rejection reason is required", path: ["rejectionReason"] });
  }
});

export type ReviewDepositRequest = z.infer<typeof ReviewDepositRequest>;

export const ReleaseDepositRequest = z.object({
  releaseReferenceNumber: z.string().trim().min(3).max(100).regex(/^[A-Za-z0-9][A-Za-z0-9./_-]*$/),
  releaseDocumentId: z.string().uuid(),
});
export type ReleaseDepositRequest = z.infer<typeof ReleaseDepositRequest>;
