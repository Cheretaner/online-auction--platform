import type { DisputeStatus } from "@auction/shared";
import { query, queryAll, queryOne } from "../infrastructure/database/query.js";

export interface DisputeRecord {
  id: string;
  auctionId: string;
  raisedBy: string;
  assignedReviewer?: string;
  status: DisputeStatus;
  reason: string;
  evidence: Record<string, unknown>;
  decision?: string;
  decisionReason?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface DbDispute {
  id: string;
  auction_id: string;
  raised_by: string;
  assigned_reviewer: string | null;
  status: DisputeStatus;
  reason: string;
  evidence: Record<string, unknown>;
  decision: string | null;
  decision_reason: string | null;
  resolved_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

function mapDispute(row: DbDispute): DisputeRecord {
  return {
    id: row.id,
    auctionId: row.auction_id,
    raisedBy: row.raised_by,
    assignedReviewer: row.assigned_reviewer ?? undefined,
    status: row.status,
    reason: row.reason,
    evidence: row.evidence ?? {},
    decision: row.decision ?? undefined,
    decisionReason: row.decision_reason ?? undefined,
    resolvedAt: row.resolved_at?.toISOString(),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function insertDispute(input: {
  auctionId: string;
  raisedBy: string;
  reason: string;
  evidence: Record<string, unknown>;
}): Promise<DisputeRecord> {
  const result = await query<DbDispute>(
    `INSERT INTO disputes (auction_id, raised_by, reason, evidence, status)
     VALUES ($1, $2, $3, $4::jsonb, 'open')
     RETURNING *`,
    [input.auctionId, input.raisedBy, input.reason, JSON.stringify(input.evidence)],
  );
  return mapDispute(result.rows[0]);
}

export async function findDispute(id: string): Promise<DisputeRecord | null> {
  const row = await queryOne<DbDispute>(`SELECT * FROM disputes WHERE id = $1`, [id]);
  return row ? mapDispute(row) : null;
}

export async function listDisputes(input: {
  auctionId?: string;
  raisedBy?: string;
}): Promise<DisputeRecord[]> {
  if (input.auctionId) {
    const rows = await queryAll<DbDispute>(
      `SELECT * FROM disputes WHERE auction_id = $1 ORDER BY created_at DESC`,
      [input.auctionId],
    );
    return rows.map(mapDispute);
  }
  if (input.raisedBy) {
    const rows = await queryAll<DbDispute>(
      `SELECT * FROM disputes WHERE raised_by = $1 ORDER BY created_at DESC`,
      [input.raisedBy],
    );
    return rows.map(mapDispute);
  }
  const rows = await queryAll<DbDispute>(`SELECT * FROM disputes ORDER BY created_at DESC LIMIT 200`);
  return rows.map(mapDispute);
}

export async function assignReviewer(id: string, reviewerId: string): Promise<DisputeRecord> {
  const result = await query<DbDispute>(
    `UPDATE disputes
        SET assigned_reviewer = $2, status = 'under_review'
      WHERE id = $1
      RETURNING *`,
    [id, reviewerId],
  );
  return mapDispute(result.rows[0]);
}

export async function resolveDispute(input: {
  id: string;
  status: "resolved" | "rejected";
  decision: string;
  decisionReason: string;
}): Promise<DisputeRecord> {
  const result = await query<DbDispute>(
    `UPDATE disputes
        SET status = $2, decision = $3, decision_reason = $4, resolved_at = NOW()
      WHERE id = $1
      RETURNING *`,
    [input.id, input.status, input.decision, input.decisionReason],
  );
  return mapDispute(result.rows[0]);
}
