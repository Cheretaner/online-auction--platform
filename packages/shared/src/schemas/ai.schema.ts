import { z } from "zod";

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

export const AssistantWorkflowMode = z.enum([
  "general",
  "summarize_auction",
  "missing_information",
  "compare_bid_patterns",
  "suggest_investigation",
  "draft_review_note",
  "decision_brief",
  "required_evidence",
]);

export const AssistRequest = z.object({
  prompt: z.string().min(3).max(4000),
  auctionId: z.string().uuid().optional(),
  language: z.enum(["en", "am"]).optional(),
  mode: AssistantWorkflowMode.optional(),
  role: z.string().min(1).max(80).optional(),
  sourceLinks: z.array(z.string().url()).max(20).optional(),
});
export type AssistRequest = z.infer<typeof AssistRequest>;
export type AssistantWorkflowMode = z.infer<typeof AssistantWorkflowMode>;

export const DetectAnomalyRequest = z.object({
  auctionId: z.string().uuid(),
});
export type DetectAnomalyRequest = z.infer<typeof DetectAnomalyRequest>;
