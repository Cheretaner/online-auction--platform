import { z } from "zod";

export const OpenDisputeRequest = z.object({
  auctionId: z.string().uuid(),
  reason: z.string().min(12).max(4000),
  evidence: z.record(z.unknown()).default({}),
});
export type OpenDisputeRequest = z.infer<typeof OpenDisputeRequest>;

export const AssignDisputeRequest = z.object({
  reviewerId: z.string().uuid(),
});
export type AssignDisputeRequest = z.infer<typeof AssignDisputeRequest>;

export const ResolveDisputeRequest = z.object({
  status: z.enum(["resolved", "rejected"]),
  decision: z.string().min(3).max(200),
  decisionReason: z.string().min(12).max(4000),
});
export type ResolveDisputeRequest = z.infer<typeof ResolveDisputeRequest>;
