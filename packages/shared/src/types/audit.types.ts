export interface AuditEventSummary {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  sequenceNo: number;
  hash: string;
  createdAt: string;
}
