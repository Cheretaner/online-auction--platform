import type { ReportType } from "@auction/shared";
import { query, queryAll, queryOne } from "../infrastructure/database/query.js";

export interface ReportRecord {
  id: string;
  auctionId: string;
  reportType: ReportType;
  reportVersion: number;
  chainHead: string | null;
  chainVerified: boolean;
  chainVerificationError?: string;
  reportData: Record<string, unknown>;
  generatedAt: string;
  publishedAt?: string;
}

interface DbReport {
  id: string;
  auction_id: string;
  report_type: ReportType;
  report_version: number;
  chain_head: string | null;
  chain_verified: boolean;
  chain_verification_error: string | null;
  report_data: Record<string, unknown>;
  generated_at: Date;
  published_at: Date | null;
}

function mapReport(row: DbReport): ReportRecord {
  return {
    id: row.id,
    auctionId: row.auction_id,
    reportType: row.report_type,
    reportVersion: row.report_version,
    chainHead: row.chain_head,
    chainVerified: row.chain_verified,
    chainVerificationError: row.chain_verification_error ?? undefined,
    reportData: row.report_data,
    generatedAt: row.generated_at.toISOString(),
    publishedAt: row.published_at?.toISOString(),
  };
}

export async function nextVersion(auctionId: string): Promise<number> {
  const row = await queryOne<{ version: string }>(
    `SELECT COALESCE(MAX(report_version), 0)::text AS version FROM auction_reports WHERE auction_id = $1`,
    [auctionId],
  );
  return Number(row?.version ?? 0) + 1;
}

export async function insertReport(input: {
  auctionId: string;
  reportType: ReportType;
  reportVersion: number;
  chainHead: string | null;
  chainVerified: boolean;
  chainVerificationError?: string;
  reportData: Record<string, unknown>;
}): Promise<ReportRecord> {
  const result = await query<DbReport>(
    `INSERT INTO auction_reports (
        auction_id, report_type, report_version, chain_head, chain_verified, chain_verification_error, report_data
     ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
     RETURNING *`,
    [
      input.auctionId,
      input.reportType,
      input.reportVersion,
      input.chainHead,
      input.chainVerified,
      input.chainVerificationError ?? null,
      JSON.stringify(input.reportData),
    ],
  );
  return mapReport(result.rows[0]);
}

export async function findReport(id: string): Promise<ReportRecord | null> {
  const row = await queryOne<DbReport>(`SELECT * FROM auction_reports WHERE id = $1`, [id]);
  return row ? mapReport(row) : null;
}

export async function listReports(auctionId?: string): Promise<ReportRecord[]> {
  const rows = auctionId
    ? await queryAll<DbReport>(
        `SELECT * FROM auction_reports WHERE auction_id = $1 ORDER BY generated_at DESC`,
        [auctionId],
      )
    : await queryAll<DbReport>(`SELECT * FROM auction_reports ORDER BY generated_at DESC LIMIT 100`);
  return rows.map(mapReport);
}

/** Every report, newest first. Platform operators only. */
export async function listAllReports(): Promise<ReportRecord[]> {
  const rows = await queryAll<DbReport>(
    `SELECT * FROM auction_reports ORDER BY generated_at DESC LIMIT 200`,
  );
  return rows.map(mapReport);
}

/** Reports for auctions owned by one organization. */
export async function listReportsByOrg(organizationId: string): Promise<ReportRecord[]> {
  const rows = await queryAll<DbReport>(
    `SELECT r.*
       FROM auction_reports r
       JOIN auctions a ON a.id = r.auction_id
      WHERE a.org_id = $1
      ORDER BY r.generated_at DESC
      LIMIT 200`,
    [organizationId],
  );
  return rows.map(mapReport);
}

export async function publishReport(id: string): Promise<ReportRecord | null> {
  const result = await query<DbReport>(
    `UPDATE auction_reports SET published_at = COALESCE(published_at, NOW()) WHERE id = $1 RETURNING *`,
    [id],
  );
  return result.rows[0] ? mapReport(result.rows[0]) : null;
}

export async function auctionSnapshot(auctionId: string): Promise<Record<string, unknown> | null> {
  const row = await queryOne<Record<string, unknown>>(
    `SELECT id, org_id, title, auction_type, status, start_price, reserve_price, min_increment,
            deposit_amount, current_highest_bid, bid_count, opens_at, closes_at, winner_id, winning_amount
       FROM auctions WHERE id = $1`,
    [auctionId],
  );
  return row;
}
