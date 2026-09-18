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

export async function listFlags(auctionId?: string): Promise<AnomalyFlag[]> {
  const rows = auctionId
    ? await queryAll<DbFlag>(
        `SELECT * FROM anomaly_flags WHERE auction_id = $1 ORDER BY created_at DESC`,
        [auctionId],
      )
    : await queryAll<DbFlag>(`SELECT * FROM anomaly_flags ORDER BY created_at DESC LIMIT 200`);
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
}): Promise<void> {
  await query(
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
}
