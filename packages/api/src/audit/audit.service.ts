import { env } from "../../config/env.js";
import { canonicalize } from "./canonical.js";
import { computeAuditHash, GENESIS_HASH } from "./hash.js";
import * as repo from "./audit.repository.js";
import type { AuditEvent, AuditRecordInput, ChainVerification } from "./audit.types.js";

export { GENESIS_HASH };

export async function appendAuditEvent(input: AuditRecordInput): Promise<AuditEvent> {
  const occurredAt = input.occurredAt ?? new Date();
  await repo.lockLedger(input.auctionId ?? null);

  const latest = await repo.getLatestEvent(input.auctionId ?? null);
  const prevHash = latest?.hash ?? GENESIS_HASH;
  const sequenceNo = (latest?.sequenceNo ?? 0) + 1;
  const payload = canonicalize(input.payload) as Record<string, unknown>;

  const hash = computeAuditHash({
    prevHash,
    sequenceNo,
    auctionId: input.auctionId ?? null,
    entityType: input.entityType,
    entityId: input.entityId,
    actorId: input.actorId ?? null,
    actorRole: input.actorRole,
    action: input.action,
    payload,
    occurredAt: occurredAt.toISOString(),
  });

  return repo.insertEvent({
    auctionId: input.auctionId ?? null,
    sequenceNo,
    entityType: input.entityType,
    entityId: input.entityId,
    actorId: input.actorId ?? null,
    actorRole: input.actorRole,
    action: input.action,
    payload,
    prevHash,
    hash,
    occurredAt,
  });
}

export async function listAuditEvents(input: {
  auctionId?: string;
  entityType?: string;
  entityId?: string;
  page: number;
  limit: number;
}): Promise<{ items: AuditEvent[]; total: number }> {
  return repo.listEvents(input);
}

export async function verifyAuditChain(auctionId?: string): Promise<ChainVerification> {
  const events = await repo.listChain(auctionId ?? null);
  let prevHash = GENESIS_HASH;
  for (const event of events) {
    if (event.prevHash !== prevHash) {
      return {
        intact: false,
        eventCount: events.length,
        headHash: events.at(-1)?.hash ?? null,
        brokenAtSequence: event.sequenceNo,
        error: `prev_hash mismatch at sequence ${event.sequenceNo}`,
      };
    }
    const expected = computeAuditHash({
      prevHash: event.prevHash,
      sequenceNo: event.sequenceNo,
      auctionId: event.auctionId ?? null,
      entityType: event.entityType,
      entityId: event.entityId,
      actorId: event.actorId ?? null,
      actorRole: event.actorRole,
      action: event.action,
      payload: event.payload,
      occurredAt: event.occurredAt,
    });
    if (expected !== event.hash) {
      return {
        intact: false,
        eventCount: events.length,
        headHash: events.at(-1)?.hash ?? null,
        brokenAtSequence: event.sequenceNo,
        error: `hash mismatch at sequence ${event.sequenceNo}`,
      };
    }
    prevHash = event.hash;
  }

  return {
    intact: true,
    eventCount: events.length,
    headHash: events.at(-1)?.hash ?? null,
  };
}

export function systemActorRole(): string {
  return env.NODE_ENV === "test" ? "system" : "system";
}
