import { z } from "zod";
import { COMPLIANCE_CHECK_STATUS, NOTIFICATION_CHANNEL, REPORT_TYPE } from "../enums.js";

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

export const ReviewAnomalyRequest = z.object({
  status: z.enum(["reviewed", "dismissed", "escalated"]),
  decisionNote: z.string().min(4).max(2000),
});
export type ReviewAnomalyRequest = z.infer<typeof ReviewAnomalyRequest>;

export const CategorizeRequest = z.object({
  text: z.string().min(3).max(8000),
  itemId: z.string().uuid().optional(),
});
export type CategorizeRequest = z.infer<typeof CategorizeRequest>;

export const AssistRequest = z.object({
  prompt: z.string().min(3).max(4000),
  auctionId: z.string().uuid().optional(),
});
export type AssistRequest = z.infer<typeof AssistRequest>;

export const RunComplianceRequest = z.object({
  notes: z.string().max(4000).optional(),
});
export type RunComplianceRequest = z.infer<typeof RunComplianceRequest>;

export const GenerateReportRequest = z.object({
  auctionId: z.string().uuid(),
  type: z.enum(REPORT_TYPE),
});
export type GenerateReportRequest = z.infer<typeof GenerateReportRequest>;

export const SendNotificationRequest = z.object({
  userId: z.string().uuid(),
  channel: z.enum(NOTIFICATION_CHANNEL),
  type: z.string().min(3).max(80),
  title: z.string().min(3).max(200),
  message: z.string().min(1).max(4000),
  relatedEntityType: z.string().max(80).optional(),
  relatedEntityId: z.string().uuid().optional(),
});
export type SendNotificationRequest = z.infer<typeof SendNotificationRequest>;

export const ComplianceCheckStatusSchema = z.enum(COMPLIANCE_CHECK_STATUS);
