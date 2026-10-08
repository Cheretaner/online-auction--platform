import { randomUUID } from "node:crypto";
import type { AuditRecordInput } from "../audit/audit.types.js";
import type { AssistantWorkflowMode } from "./assistant.workflow.js";

export interface AssistantProvenanceInput {
  actorId?: string;
  actorRoles: string[];
  auctionId?: string;
  mode: AssistantWorkflowMode;
  role: string;
  provider: string;
  fallback: boolean;
  sourceLinks: string[];
}

export function buildAssistantProvenance(
  input: AssistantProvenanceInput,
): AuditRecordInput {
  return {
    auctionId: input.auctionId ?? null,
    actorId: input.actorId ?? null,
    actorRole: input.role || input.actorRoles.join(",") || "authenticated_user",
    entityType: "ai_assistant",
    entityId: randomUUID(),
    action: "ai_assistant.invoked",
    payload: {
      mode: input.mode,
      role: input.role,
      provider: input.provider,
      fallback: input.fallback,
      sourceLinkCount: input.sourceLinks.length,
    },
  };
}
