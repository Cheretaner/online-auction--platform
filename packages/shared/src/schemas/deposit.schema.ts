import { z } from "zod";
import { INSTRUMENT_TYPES, DEPOSIT_STATUS } from "../enums.js";
import { Money } from "./money.js";

export const CreateDepositRequest = z.object({
  auctionId: z.string().uuid(),
  amount: Money,
  referenceNumber: z.string().min(1).max(100),
  issuingBank: z.string().min(1).max(200),
  instrumentType: z.enum(INSTRUMENT_TYPES),
  documentId: z.string().uuid().optional(),
});

export type CreateDepositRequest = z.infer<typeof CreateDepositRequest>;

export const ReviewDepositRequest = z.object({
  decision: z.enum(["verified", "rejected"]),
  rejectionReason: z.string().min(1).max(1000).optional(),
}).superRefine((data, ctx) => {
  if (data.decision === "rejected" && !data.rejectionReason) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Rejection reason is required", path: ["rejectionReason"] });
  }
});

export type ReviewDepositRequest = z.infer<typeof ReviewDepositRequest>;
