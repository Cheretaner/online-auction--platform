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

export interface FinancialReconciliationSnapshot {
  auctionId: string;
  deposits: Array<{ status: string; instrumentType: string; count: string; amount: string }>;
  providerPayments: Array<{ status: string; count: string; amount: string }>;
  providerRefunds: Array<{ status: string; count: string; amount: string }>;
  settlements: Array<{ status: string; count: string; amount: string }>;
  exceptions: Array<{ issue: string; entityId: string; txRef: string | null; amount: string }>;
}

export interface HistoricalAuctionInsights {
  auctionCount: number;
  awardedCount: number;
  medianWinningPrice: string | null;
  medianBidCount: number | null;
  awardRate: number | null;
  months: number;
  criteria: { auctionType: string; region: string | null; categories: string[] };
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

export async function financialReconciliation(auctionId: string): Promise<FinancialReconciliationSnapshot> {
  const [deposits, providerPayments, providerRefunds, settlements, exceptions] = await Promise.all([
    queryAll<{ status: string; instrument_type: string; count: string; amount: string }>(
      `SELECT status, instrument_type, COUNT(*)::text AS count, COALESCE(SUM(amount), 0)::text AS amount
         FROM deposits WHERE auction_id = $1 GROUP BY status, instrument_type ORDER BY status, instrument_type`,
      [auctionId],
    ),
    queryAll<{ status: string; count: string; amount: string }>(
      `SELECT pt.status, COUNT(*)::text AS count, COALESCE(SUM(pt.amount), 0)::text AS amount
         FROM provider_transactions pt
         LEFT JOIN deposits d ON d.id = pt.deposit_id
         LEFT JOIN settlement_obligations s ON s.id = pt.settlement_id
        WHERE COALESCE(d.auction_id, s.auction_id) = $1
        GROUP BY pt.status ORDER BY pt.status`,
      [auctionId],
    ),
    queryAll<{ status: string; count: string; amount: string }>(
      `SELECT status, COUNT(*)::text AS count, COALESCE(SUM(amount), 0)::text AS amount
         FROM provider_refunds WHERE auction_id = $1 GROUP BY status ORDER BY status`,
      [auctionId],
    ),
    queryAll<{ status: string; count: string; amount: string }>(
      `SELECT status, COUNT(*)::text AS count, COALESCE(SUM(amount), 0)::text AS amount
         FROM settlement_obligations WHERE auction_id = $1 GROUP BY status ORDER BY status`,
      [auctionId],
    ),
    queryAll<{ issue: string; entity_id: string; tx_ref: string | null; amount: string }>(
      `SELECT 'successful_deposit_not_verified' AS issue, d.id::text AS entity_id, pt.tx_ref,
              pt.amount::text AS amount
         FROM provider_transactions pt JOIN deposits d ON d.id = pt.deposit_id
        WHERE d.auction_id = $1 AND pt.status = 'succeeded' AND d.status NOT IN ('verified', 'released')
       UNION ALL
       SELECT 'refund_confirmed_deposit_not_released', d.id::text, pt.tx_ref, pr.amount::text
         FROM provider_refunds pr
         JOIN deposits d ON d.id = pr.deposit_id
         JOIN provider_transactions pt ON pt.id = pr.provider_transaction_id
        WHERE d.auction_id = $1 AND pr.status = 'refunded' AND d.status <> 'released'
       UNION ALL
       SELECT 'refund_requires_reconciliation', d.id::text, pt.tx_ref, pr.amount::text
         FROM provider_refunds pr
         JOIN deposits d ON d.id = pr.deposit_id
         JOIN provider_transactions pt ON pt.id = pr.provider_transaction_id
        WHERE d.auction_id = $1 AND pr.status IN ('reversed', 'failed', 'reconciliation_required')
       UNION ALL
       SELECT 'overdue_settlement_unpaid', s.id::text, NULL, s.amount::text
         FROM settlement_obligations s
        WHERE s.auction_id = $1 AND s.status IN ('due', 'payment_pending') AND s.due_at < NOW()
       ORDER BY issue, entity_id`,
      [auctionId],
    ),
  ]);

  return {
    auctionId,
    deposits: deposits.map((row) => ({
      status: row.status,
      instrumentType: row.instrument_type,
      count: row.count,
      amount: row.amount,
    })),
    providerPayments,
    providerRefunds,
    settlements,
    exceptions: exceptions.map((row) => ({
      issue: row.issue,
      entityId: row.entity_id,
      txRef: row.tx_ref,
      amount: row.amount,
    })),
  };
}

export async function historicalInsights(auctionId: string): Promise<HistoricalAuctionInsights> {
  const row = await queryOne<{
    auction_count: string;
    awarded_count: string;
    median_winning_price: string | null;
    median_bid_count: string | null;
    award_rate: string | null;
    auction_type: string;
    region: string | null;
    categories: string[] | null;
  }>(
    `WITH target AS (
       SELECT a.org_id, a.auction_type, a.region,
              ARRAY(SELECT DISTINCT i.category_id FROM auction_items i
                    WHERE i.auction_id = a.id AND i.category_id IS NOT NULL) AS categories
         FROM auctions a WHERE a.id = $1
     ), history AS (
       SELECT a.status, a.winning_amount, a.bid_count
         FROM auctions a CROSS JOIN target t
        WHERE a.org_id = t.org_id
          AND a.id <> $1
          AND a.auction_type = t.auction_type
          AND a.status IN ('closed', 'awarded', 'cancelled')
          AND a.closed_at >= NOW() - INTERVAL '36 months'
          AND (t.region IS NULL OR lower(trim(a.region)) = lower(trim(t.region)))
          AND (cardinality(t.categories) = 0 OR EXISTS (
            SELECT 1 FROM auction_items i
             WHERE i.auction_id = a.id AND i.category_id = ANY(t.categories)
          ))
     ), metrics AS (
       SELECT COUNT(*)::text AS auction_count,
              COUNT(*) FILTER (WHERE status = 'awarded')::text AS awarded_count,
              round((percentile_cont(0.5) WITHIN GROUP (ORDER BY winning_amount)
                FILTER (WHERE status = 'awarded'))::numeric, 2)::text AS median_winning_price,
              percentile_cont(0.5) WITHIN GROUP (ORDER BY bid_count)::text AS median_bid_count,
              round((COUNT(*) FILTER (WHERE status = 'awarded')::numeric / NULLIF(COUNT(*), 0))::numeric, 4)::text AS award_rate
         FROM history
     )
     SELECT m.auction_count, m.awarded_count, m.median_winning_price, m.median_bid_count,
            m.award_rate, t.auction_type, t.region,
            ARRAY(SELECT c.name FROM categories c WHERE c.id = ANY(t.categories) ORDER BY c.name) AS categories
       FROM target t CROSS JOIN metrics m`,
    [auctionId],
  );
  const auctionCount = Number(row?.auction_count ?? 0);
  return {
    auctionCount,
    awardedCount: Number(row?.awarded_count ?? 0),
    medianWinningPrice: row?.median_winning_price ?? null,
    medianBidCount: row?.median_bid_count === null || row?.median_bid_count === undefined
      ? null
      : Number(row.median_bid_count),
    awardRate: row?.award_rate === null || row?.award_rate === undefined
      ? null
      : Number(row.award_rate),
    months: 36,
    criteria: {
      auctionType: row?.auction_type ?? "unknown",
      region: row?.region ?? null,
      categories: row?.categories ?? [],
    },
  };
}
