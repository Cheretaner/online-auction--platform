import { queryAll } from "../infrastructure/database/query.js";
import {
  commandCenterActionPath,
  type CommandCenterException,
  type ExceptionSeverity,
  type ExceptionSource,
} from "./command-center.service.js";

interface DbException {
  id: string;
  source: ExceptionSource;
  title: string;
  status: CommandCenterException["status"];
  severity: ExceptionSeverity;
  created_at: Date;
  updated_at: Date;
  auction_id: string | null;
  action_path: string;
}

export async function listExceptions(orgId?: string): Promise<CommandCenterException[]> {
  const rows = await queryAll<DbException>(
    `WITH organization_items AS (
      SELECT
        v.id::text AS id,
        'verification' AS source,
        'KYC verification' AS title,
        v.status::text AS status,
        CASE v.status
          WHEN 'pending' THEN 'high'
          WHEN 'unverified' THEN 'medium'
          ELSE 'low'
        END AS severity,
        v.created_at,
        v.updated_at,
        NULL::text AS auction_id,
        '/app/kyc/review' AS action_path
      FROM verifications v
      JOIN organization_members om ON om.user_id = v.user_id
      WHERE ($1::uuid IS NULL OR om.organization_id = $1)
        AND v.status = 'pending'

      UNION ALL
      SELECT
        d.id::text,
        'deposit' AS source,
        'Deposit ' || d.status AS title,
        d.status::text AS status,
        CASE d.status WHEN 'pending' THEN 'high' ELSE 'low' END AS severity,
        d.created_at,
        d.updated_at,
        d.auction_id::text AS auction_id,
        '/app/deposits' AS action_path
      FROM deposits d
      JOIN auctions a ON a.id = d.auction_id
      WHERE ($1::uuid IS NULL OR a.org_id = $1)
        AND d.status = 'pending'

      UNION ALL
      SELECT
        d.id::text,
        'dispute' AS source,
        'Dispute ' || d.status AS title,
        d.status::text AS status,
        CASE d.status WHEN 'open' THEN 'high' WHEN 'under_review' THEN 'medium' ELSE 'low' END AS severity,
        d.created_at,
        d.updated_at,
        d.auction_id::text AS auction_id,
        '/app/disputes' AS action_path
      FROM disputes d
      JOIN auctions a ON a.id = d.auction_id
      WHERE ($1::uuid IS NULL OR a.org_id = $1)
        AND d.status IN ('open', 'under_review')

      UNION ALL
      SELECT
        f.id::text,
        'anomaly' AS source,
        'Anomaly ' || f.severity AS title,
        f.status::text AS status,
        f.severity::text AS severity,
        f.created_at,
        f.updated_at,
        f.auction_id::text AS auction_id,
        '/app/ai' AS action_path
      FROM anomaly_flags f
      JOIN auctions a ON a.id = f.auction_id
      WHERE ($1::uuid IS NULL OR a.org_id = $1)
        AND f.status = 'open'
    )
    SELECT * FROM organization_items
    ORDER BY severity DESC, created_at ASC
    LIMIT 100`,
    [orgId ?? null],
  );

  return rows.map((row) => {
    const item: CommandCenterException = {
      id: row.id,
      source: row.source,
      title: row.title,
      status: row.status,
      severity: row.severity,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
      auctionId: row.auction_id,
      actionPath: row.action_path,
    };
    return { ...item, actionPath: commandCenterActionPath(item) };
  });
}
