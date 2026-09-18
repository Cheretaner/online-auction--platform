export interface AuditEvent {
  id: string;
  auctionId?: string;
  sequenceNo: number;
  entityType: string;
  entityId: string;
  actorId?: string;
  actorRole: string;
  action: string;
  payload: Record<string, unknown>;
  prevHash: string;
  hash: string;
  occurredAt: string;
}

export interface AuditRecordInput {
  auctionId?: string | null;
  actorId?: string | null;
  actorRole: string;
  entityType: string;
  entityId: string;
  action: string;
  payload: Record<string, unknown>;
  occurredAt?: Date;
}

export interface ChainVerification {
  intact: boolean;
  eventCount: number;
  headHash: string | null;
  brokenAtSequence?: number;
  error?: string;
}
