import type { ComplianceCheckStatus } from "@auction/shared";
import { query, queryAll } from "../infrastructure/database/query.js";

export interface ComplianceCheckRecord {
  id: string;
  auctionId: string;
  checkedBy: string;
  status: ComplianceCheckStatus;
  findings: unknown[];
  notes?: string;
  createdAt: string;
}

interface DbCheck {
  id: string;
  auction_id: string;
  checked_by: string;
  status: ComplianceCheckStatus;
  findings: unknown[];
  notes: string | null;
  created_at: Date;
}

function mapCheck(row: DbCheck): ComplianceCheckRecord {
  return {
    id: row.id,
    auctionId: row.auction_id,
    checkedBy: row.checked_by,
    status: row.status,
    findings: Array.isArray(row.findings) ? row.findings : [],
    notes: row.notes ?? undefined,
    createdAt: row.created_at.toISOString(),
  };
}

export async function insertCheck(input: {
  auctionId: string;
  checkedBy: string;
  status: ComplianceCheckStatus;
  findings: unknown[];
  notes?: string;
}): Promise<ComplianceCheckRecord> {
  const result = await query<DbCheck>(
    `INSERT INTO compliance_checks (auction_id, checked_by, status, findings, notes)
     VALUES ($1, $2, $3, $4::jsonb, $5)
     RETURNING *`,
    [input.auctionId, input.checkedBy, input.status, JSON.stringify(input.findings), input.notes ?? null],
  );
  return mapCheck(result.rows[0]);
}

export async function listByAuction(auctionId: string): Promise<ComplianceCheckRecord[]> {
  const rows = await queryAll<DbCheck>(
    `SELECT * FROM compliance_checks WHERE auction_id = $1 ORDER BY created_at DESC`,
    [auctionId],
  );
  return rows.map(mapCheck);
}

export async function countUnverifiedBidders(auctionId: string): Promise<number> {
  const rows = await queryAll<{ count: string }>(
    `SELECT COUNT(DISTINCT b.bidder_id)::text AS count
       FROM bids b
       JOIN profiles p ON p.id = b.bidder_id
      WHERE b.auction_id = $1 AND b.status = 'active' AND p.verification_status <> 'verified'`,
    [auctionId],
  );
  return Number(rows[0]?.count ?? 0);
}

export async function countMissingDeposits(auctionId: string, requiredAmount: string): Promise<number> {
  const rows = await queryAll<{ count: string }>(
    `SELECT COUNT(DISTINCT b.bidder_id)::text AS count
       FROM bids b
       LEFT JOIN deposits d
         ON d.auction_id = b.auction_id
        AND d.bidder_id = b.bidder_id
        AND d.status = 'verified'
        AND d.amount >= $2::numeric
      WHERE b.auction_id = $1 AND b.status = 'active' AND d.id IS NULL`,
    [auctionId, requiredAmount],
  );
  return Number(rows[0]?.count ?? 0);
}

export async function countOpenDisputes(auctionId: string): Promise<number> {
  const rows = await queryAll<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM disputes
      WHERE auction_id = $1 AND status IN ('open', 'under_review')`,
    [auctionId],
  );
  return Number(rows[0]?.count ?? 0);
}
