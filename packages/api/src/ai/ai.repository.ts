import type { AnomalySeverity, AnomalyStatus } from "@auction/shared";
import { query, queryAll, queryOne } from "../infrastructure/database/query.js";

export interface AnomalyFlag {
  id: string;
  auctionId: string;
  subjectAccounts: string[];
  score: string;
  severity: AnomalySeverity;
  status: AnomalyStatus;
  triggeredRules: string[];
  featureValues: Record<string, unknown>;
  explanation?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  decisionNote?: string;
  createdAt: string;
}

interface DbFlag {
  id: string;
  auction_id: string;
  subject_accounts: string[];
  score: string;
  severity: AnomalySeverity;
  status: AnomalyStatus;
  triggered_rules: string[];
  feature_values: Record<string, unknown>;
  explanation: string | null;
  reviewed_by: string | null;
  reviewed_at: Date | null;
  decision_note: string | null;
  created_at: Date;
}

function mapFlag(row: DbFlag): AnomalyFlag {
  return {
    id: row.id,
    auctionId: row.auction_id,
    subjectAccounts: row.subject_accounts,
    score: row.score,
    severity: row.severity,
    status: row.status,
    triggeredRules: row.triggered_rules,
    featureValues: row.feature_values,
    explanation: row.explanation ?? undefined,
    reviewedBy: row.reviewed_by ?? undefined,
    reviewedAt: row.reviewed_at?.toISOString(),
    decisionNote: row.decision_note ?? undefined,
    createdAt: row.created_at.toISOString(),
  };
}

export async function insertFlag(input: {
  auctionId: string;
  subjectAccounts: string[];
  score: number;
  severity: AnomalySeverity;
  triggeredRules: string[];
  featureValues: Record<string, unknown>;
  explanation: string;
}): Promise<AnomalyFlag> {
  const result = await query<DbFlag>(
    `INSERT INTO anomaly_flags (
        auction_id, subject_accounts, score, severity, triggered_rules, feature_values, explanation
     ) VALUES ($1, $2::uuid[], $3, $4, $5::text[], $6::jsonb, $7)
     RETURNING *`,
    [
      input.auctionId,
      input.subjectAccounts,
      input.score,
      input.severity,
      input.triggeredRules,
      JSON.stringify(input.featureValues),
      input.explanation,
    ],
  );
  return mapFlag(result.rows[0]);
}

export async function listFlags(filter: { auctionId?: string; orgId?: string } = {}): Promise<AnomalyFlag[]> {
  if (filter.auctionId) {
    const rows = await queryAll<DbFlag>(
      `SELECT * FROM anomaly_flags WHERE auction_id = $1 ORDER BY created_at DESC`,
      [filter.auctionId],
    );
    return rows.map(mapFlag);
  }
  if (filter.orgId) {
    const rows = await queryAll<DbFlag>(
      `SELECT f.* FROM anomaly_flags f
         JOIN auctions a ON a.id = f.auction_id
        WHERE a.org_id = $1
        ORDER BY f.created_at DESC
        LIMIT 200`,
      [filter.orgId],
    );
    return rows.map(mapFlag);
  }
  const rows = await queryAll<DbFlag>(`SELECT * FROM anomaly_flags ORDER BY created_at DESC LIMIT 200`);
  return rows.map(mapFlag);
}

export async function findFlag(id: string): Promise<AnomalyFlag | null> {
  const row = await queryOne<DbFlag>(`SELECT * FROM anomaly_flags WHERE id = $1`, [id]);
  return row ? mapFlag(row) : null;
}

export async function reviewFlag(input: {
  id: string;
  reviewerId: string;
  status: AnomalyStatus;
  decisionNote: string;
}): Promise<AnomalyFlag | null> {
  const result = await query<DbFlag>(
    `UPDATE anomaly_flags
        SET status = $2, reviewed_by = $3, reviewed_at = NOW(), decision_note = $4
      WHERE id = $1
      RETURNING *`,
    [input.id, input.status, input.reviewerId, input.decisionNote],
  );
  return result.rows[0] ? mapFlag(result.rows[0]) : null;
}

export async function countOpenHigh(auctionId: string): Promise<number> {
  const row = await queryOne<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM anomaly_flags
      WHERE auction_id = $1 AND status = 'open' AND severity = 'high'`,
    [auctionId],
  );
  return Number(row?.count ?? 0);
}

export async function listCategories(): Promise<Array<{ slug: string; name: string }>> {
  return queryAll(`SELECT slug, name FROM categories WHERE is_active = TRUE ORDER BY name`);
}

export async function applyItemCategory(input: {
  itemId: string;
  categorySlug: string;
  subCategory?: string;
  confidence: number;
  rationale: string;
}): Promise<boolean> {
  const result = await query(
    `UPDATE auction_items i
        SET category_id = c.id,
            ai_category_suggestion = $2,
            ai_sub_category = $3,
            ai_confidence = $4,
            ai_rationale = $5
       FROM categories c
      WHERE i.id = $1 AND c.slug = $2`,
    [input.itemId, input.categorySlug, input.subCategory ?? null, input.confidence, input.rationale],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function findItemAuctionId(itemId: string): Promise<string | null> {
  const row = await queryOne<{ auction_id: string }>(
    `SELECT auction_id FROM auction_items WHERE id = $1`,
    [itemId],
  );
  return row?.auction_id ?? null;
}

/**
 * Get historical flags for specific bidders
 * Used to show pattern of past behavior
 */
export async function getHistoricalFlagsForBidders(
  bidderIds: string[],
  limit: number = 50,
): Promise<AnomalyFlag[]> {
  if (bidderIds.length === 0) return [];

  const rows = await queryAll<DbFlag>(
    `SELECT * FROM anomaly_flags
     WHERE subject_accounts && $1::uuid[]
     ORDER BY created_at DESC
     LIMIT $2`,
    [bidderIds, limit],
  );
  return rows.map(mapFlag);
}

/**
 * Get historical flags by specific rule types
 * Used to find similar past patterns
 */
export async function getHistoricalFlagsByRules(
  rules: string[],
  limit: number = 50,
): Promise<AnomalyFlag[]> {
  if (rules.length === 0) return [];

  const rows = await queryAll<DbFlag>(
    `SELECT * FROM anomaly_flags
     WHERE triggered_rules && $1::text[]
     ORDER BY created_at DESC
     LIMIT $2`,
    [rules, limit],
  );
  return rows.map(mapFlag);
}

/**
 * Get flags for a specific auction's organization
 * Shows historical compliance context
 */
export async function getHistoricalFlagsForOrg(
  orgId: string,
  limit: number = 100,
): Promise<AnomalyFlag[]> {
  const rows = await queryAll<DbFlag>(
    `SELECT f.* FROM anomaly_flags f
     JOIN auctions a ON a.id = f.auction_id
     WHERE a.org_id = $1
     ORDER BY f.created_at DESC
     LIMIT $2`,
    [orgId, limit],
  );
  return rows.map(mapFlag);
}

/**
 * Get statistics on flag outcomes by rule type
 * Shows how similar flags were resolved historically
 */
export async function getFlagOutcomeStatsByRule(
  rule: string,
): Promise<{
  rule: string;
  totalFlags: number;
  reviewedCount: number;
  dismissedCount: number;
  escalatedCount: number;
  avgScore: number;
  avgResolutionDays: number | null;
}> {
  const row = await queryOne<{
    rule: string;
    total_flags: number;
    reviewed_count: number;
    dismissed_count: number;
    escalated_count: number;
    avg_score: number;
    avg_resolution_days: number | null;
  }>(
    `SELECT 
      $1 as rule,
      COUNT(*) as total_flags,
      COUNT(CASE WHEN status = 'reviewed' THEN 1 END) as reviewed_count,
      COUNT(CASE WHEN status = 'dismissed' THEN 1 END) as dismissed_count,
      COUNT(CASE WHEN status = 'escalated' THEN 1 END) as escalated_count,
      AVG(score::numeric) as avg_score,
      AVG(CASE 
        WHEN reviewed_at IS NOT NULL 
        THEN EXTRACT(EPOCH FROM (reviewed_at - created_at)) / 86400
      END) as avg_resolution_days
     FROM anomaly_flags
     WHERE $1 = ANY(triggered_rules)`,
    [rule],
  );

  if (!row) {
    return {
      rule,
      totalFlags: 0,
      reviewedCount: 0,
      dismissedCount: 0,
      escalatedCount: 0,
      avgScore: 0,
      avgResolutionDays: null,
    };
  }

  return {
    rule: row.rule,
    totalFlags: row.total_flags,
    reviewedCount: row.reviewed_count,
    dismissedCount: row.dismissed_count,
    escalatedCount: row.escalated_count,
    avgScore: row.avg_score,
    avgResolutionDays: row.avg_resolution_days,
  };
}

/**
 * Get bidder risk profile based on historical flags
 */
export async function getBidderRiskProfile(
  bidderId: string,
): Promise<{
  bidderId: string;
  totalFlags: number;
  highSeverityFlags: number;
  recentFlags: number; // Last 6 months
  mostCommonRules: string[];
  dismissalRate: number;
  lastFlaggedAt: Date | null;
}> {
  const row = await queryOne<{
    bidder_id: string;
    total_flags: number;
    high_severity_flags: number;
    recent_flags: number;
    most_common_rules: string[];
    dismissal_rate: number;
    last_flagged_at: Date | null;
  }>(
    `WITH bidder_flags AS (
      SELECT *
      FROM anomaly_flags
      WHERE $1 = ANY(subject_accounts)
    )
    SELECT 
      $1 as bidder_id,
      COUNT(*) as total_flags,
      COUNT(CASE WHEN severity = 'high' THEN 1 END) as high_severity_flags,
      COUNT(CASE WHEN created_at >= NOW() - INTERVAL '6 months' THEN 1 END) as recent_flags,
      (
        SELECT ARRAY_AGG(DISTINCT rule)
        FROM bidder_flags bf, UNNEST(bf.triggered_rules) AS rule
        GROUP BY rule
        ORDER BY COUNT(*) DESC
        LIMIT 3
      ) as most_common_rules,
      CASE 
        WHEN COUNT(*) > 0 
        THEN (COUNT(CASE WHEN status = 'dismissed' THEN 1 END)::numeric / COUNT(*)::numeric * 100)
        ELSE 0 
      END as dismissal_rate,
      MAX(created_at) as last_flagged_at
    FROM bidder_flags`,
    [bidderId],
  );

  if (!row || row.total_flags === 0) {
    return {
      bidderId,
      totalFlags: 0,
      highSeverityFlags: 0,
      recentFlags: 0,
      mostCommonRules: [],
      dismissalRate: 0,
      lastFlaggedAt: null,
    };
  }

  return {
    bidderId: row.bidder_id,
    totalFlags: row.total_flags,
    highSeverityFlags: row.high_severity_flags,
    recentFlags: row.recent_flags,
    mostCommonRules: row.most_common_rules || [],
    dismissalRate: row.dismissal_rate,
    lastFlaggedAt: row.last_flagged_at,
  };
}
