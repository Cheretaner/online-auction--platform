import { createHash } from "node:crypto";
import { canonicalize } from "./canonical.js";

export const GENESIS_HASH = "0".repeat(64);

export function computeAuditHash(input: {
  prevHash: string;
  sequenceNo: number;
  auctionId: string | null;
  entityType: string;
  entityId: string;
  actorId: string | null;
  actorRole: string;
  action: string;
  payload: unknown;
  occurredAt: string;
}): string {
  const canonical = JSON.stringify(
    canonicalize({
      prevHash: input.prevHash,
      sequenceNo: input.sequenceNo,
      auctionId: input.auctionId,
      entityType: input.entityType,
      entityId: input.entityId,
      actorId: input.actorId,
      actorRole: input.actorRole,
      action: input.action,
      payload: input.payload,
      occurredAt: input.occurredAt,
    }),
  );
  return createHash("sha256").update(canonical).digest("hex");
}
