export interface AuditEvent {
  id: string;
  organizationId?: string;
  actorId?: string;
  entityType: string;
  entityId: string;
  action: string;
  payload: Record<string, unknown>;
  sequenceNo: number;
  prevHash?: string;
  hash: string;
  createdAt: string;
}
