export interface AuditEventSummary {
  id: string;
  auctionId?: string;
  entityType: string;
  entityId: string;
  action: string;
  sequenceNo: number;
  prevHash: string;
  hash: string;
  occurredAt: string;
}

export interface AuditChainVerification {
  intact: boolean;
  eventCount: number;
  headHash: string | null;
  brokenAtSequence?: number;
  error?: string;
}
