import { query } from "../infrastructure/database/query.js";
import type { AuditEvent } from "./audit.types.js";

interface DbAuditEvent {
  id: string;
  organization_id: string | null;
  actor_id: string | null;
  entity_type: string;
  entity_id: string;
  action: string;
  payload: Record<string, unknown>;
  sequence_no: number;
  prev_hash: string | null;
  hash: string;
  created_at: Date;
}

function mapEvent(row: DbAuditEvent): AuditEvent {
  return {
    id: row.id,
    organizationId: row.organization_id ?? undefined,
    actorId: row.actor_id ?? undefined,
    entityType: row.entity_type,
    entityId: row.entity_id,
    action: row.action,
    payload: row.payload,
    sequenceNo: row.sequence_no,
    prevHash: row.prev_hash ?? undefined,
    hash: row.hash,
    createdAt: row.created_at.toISOString(),
  };
}

export async function getLatestEvent(): Promise<AuditEvent | null> {
  const result = await query<DbAuditEvent>(
    "SELECT * FROM audit_events ORDER BY sequence_no DESC LIMIT 1",
  );
  return result.rows[0] ? mapEvent(result.rows[0]) : null;
}

export async function insertEvent(input: {
  organizationId?: string;
  actorId?: string;
  entityType: string;
  entityId: string;
  action: string;
  payload: Record<string, unknown>;
  prevHash?: string;
  hash: string;
}): Promise<AuditEvent> {
  const result = await query<DbAuditEvent>(
    `INSERT INTO audit_events
      (organization_id, actor_id, entity_type, entity_id, action, payload, prev_hash, hash)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      input.organizationId ?? null,
      input.actorId ?? null,
      input.entityType,
      input.entityId,
      input.action,
      input.payload,
      input.prevHash ?? null,
      input.hash,
    ],
  );
  return mapEvent(result.rows[0]);
}
