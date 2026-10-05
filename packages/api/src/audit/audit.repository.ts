import { query, queryAll, queryOne } from "../infrastructure/database/query.js";
import { GLOBAL_LEDGER_SCOPE } from "../kernel/events.js";
import type { AuditEvent } from "./audit.types.js";

interface DbAuditEvent {
  id: string;
  auction_id: string | null;
  sequence_no: string | number;
  entity_type: string;
  entity_id: string;
  actor_id: string | null;
  actor_role: string;
  action: string;
  payload: Record<string, unknown>;
  prev_hash: string;
  hash: string;
  occurred_at: Date;
}

function mapEvent(row: DbAuditEvent): AuditEvent {
  return {
    id: row.id,
    auctionId: row.auction_id ?? undefined,
    sequenceNo: Number(row.sequence_no),
    entityType: row.entity_type,
    entityId: row.entity_id,
    actorId: row.actor_id ?? undefined,
    actorRole: row.actor_role,
    action: row.action,
    payload: row.payload,
    prevHash: row.prev_hash,
    hash: row.hash,
    occurredAt: row.occurred_at.toISOString(),
  };
}

function ledgerScope(auctionId: string | null): string {
  return auctionId ?? GLOBAL_LEDGER_SCOPE;
}

export async function lockLedger(auctionId: string | null): Promise<void> {
  await query("SELECT pg_advisory_xact_lock(hashtext($1))", [`audit:${ledgerScope(auctionId)}`]);
}

export async function getLatestEvent(auctionId: string | null): Promise<AuditEvent | null> {
  const row = await queryOne<DbAuditEvent>(
    `SELECT * FROM audit_events
      WHERE ledger_scope = $1::uuid
      ORDER BY sequence_no DESC
      LIMIT 1`,
    [ledgerScope(auctionId)],
  );
  return row ? mapEvent(row) : null;
}

export async function insertEvent(input: {
  auctionId: string | null;
  sequenceNo: number;
  entityType: string;
  entityId: string;
  actorId: string | null;
  actorRole: string;
  action: string;
  payload: Record<string, unknown>;
  prevHash: string;
  hash: string;
  occurredAt: Date;
}): Promise<AuditEvent> {
  const result = await query<DbAuditEvent>(
    `INSERT INTO audit_events (
        auction_id, sequence_no, entity_type, entity_id, actor_id, actor_role,
        action, payload, prev_hash, hash, occurred_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11)
     RETURNING *`,
    [
      input.auctionId,
      input.sequenceNo,
      input.entityType,
      input.entityId,
      input.actorId,
      input.actorRole,
      input.action,
      JSON.stringify(input.payload),
      input.prevHash,
      input.hash,
      input.occurredAt,
    ],
  );
  return mapEvent(result.rows[0]);
}

export async function listChain(auctionId: string | null): Promise<AuditEvent[]> {
  const rows = await queryAll<DbAuditEvent>(
    `SELECT * FROM audit_events
      WHERE ledger_scope = $1::uuid
      ORDER BY sequence_no ASC`,
    [ledgerScope(auctionId)],
  );
  return rows.map(mapEvent);
}

export async function listEvents(input: {
  auctionId?: string;
  entityType?: string;
  entityId?: string;
  orgId?: string;
  page: number;
  limit: number;
}): Promise<{ items: AuditEvent[]; total: number }> {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (input.auctionId) {
    params.push(input.auctionId);
    conditions.push(`e.auction_id = $${params.length}`);
  }
  if (input.entityType) {
    params.push(input.entityType);
    conditions.push(`e.entity_type = $${params.length}`);
  }
  if (input.entityId) {
    params.push(input.entityId);
    conditions.push(`e.entity_id = $${params.length}`);
  }
  if (input.orgId) {
    params.push(input.orgId);
    conditions.push(`a.org_id = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const join = input.orgId ? "JOIN auctions a ON a.id = e.auction_id" : "";
  const count = await queryOne<{ count: string }>(`SELECT COUNT(*)::text AS count FROM audit_events e ${join} ${where}`, params);
  params.push(input.limit, (input.page - 1) * input.limit);
  const rows = await queryAll<DbAuditEvent>(
    `SELECT e.* FROM audit_events e ${join} ${where}
      ORDER BY e.occurred_at DESC, e.sequence_no DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );

  return {
    items: rows.map(mapEvent),
    total: Number(count?.count ?? 0),
  };
}

export async function listOrganizationAnalytics(orgId: string): Promise<Array<{
  eventDate: string;
  actorRole: string;
  entityType: string;
  action: string;
  eventCount: string;
}>> {
  return queryAll<{
    eventDate: string;
    actorRole: string;
    entityType: string;
    action: string;
    eventCount: string;
  }>(
    `SELECT TO_CHAR(DATE_TRUNC('day', e.occurred_at AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS "eventDate",
            e.actor_role AS "actorRole", e.entity_type AS "entityType", e.action,
            COUNT(*)::text AS "eventCount"
       FROM audit_events e
       JOIN auctions a ON a.id = e.auction_id
      WHERE a.org_id = $1 AND e.occurred_at >= NOW() - INTERVAL '90 days'
      GROUP BY 1, 2, 3, 4
      ORDER BY 1 DESC, 2, 3, 4`,
    [orgId],
  );
}
