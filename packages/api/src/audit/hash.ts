import { createHash } from "node:crypto";

export function computeAuditHash(input: {
  prevHash: string | null;
  entityType: string;
  entityId: string;
  action: string;
  payload: unknown;
  sequenceNo: number;
}): string {
  const canonical = JSON.stringify({
    prevHash: input.prevHash,
    entityType: input.entityType,
    entityId: input.entityId,
    action: input.action,
    payload: input.payload,
    sequenceNo: input.sequenceNo,
  });
  return createHash("sha256").update(canonical).digest("hex");
}
