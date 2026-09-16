import { canonicalize } from "./canonical.js";
import { computeAuditHash } from "./hash.js";
import * as repo from "./audit.repository.js";
import type { AuditEvent } from "./audit.types.js";

export async function recordAuditEvent(input: {
  organizationId?: string;
  actorId?: string;
  entityType: string;
  entityId: string;
  action: string;
  payload: Record<string, unknown>;
}): Promise<AuditEvent> {
  const latest = await repo.getLatestEvent();
  const prevHash = latest?.hash ?? null;
  const payload = canonicalize(input.payload) as Record<string, unknown>;
  const sequenceNo = (latest?.sequenceNo ?? 0) + 1;
  const hash = computeAuditHash({
    prevHash,
    entityType: input.entityType,
    entityId: input.entityId,
    action: input.action,
    payload,
    sequenceNo,
  });

  return repo.insertEvent({
    ...input,
    payload,
    prevHash: prevHash ?? undefined,
    hash,
  });
}
