import { queryAll, queryOne } from "../infrastructure/database/query.js";

export interface PublicAuctionRecord {
  id: string;
  title: string;
  organization: string;
  type: string;
  status: string;
  region: string | null;
  startPrice: string;
  winningAmount: string | null;
  bidCount: number;
  opensAt: string;
  closesAt: string;
  closedAt: string | null;
  awardedAt: string | null;
  publishedAt: string;
}

const PUBLIC_FIELDS = `
  a.id,
  a.title,
  o.name AS organization,
  a.auction_type AS type,
  a.status,
  a.region,
  a.start_price::text AS "startPrice",
  CASE WHEN a.status = 'awarded' THEN a.winning_amount::text ELSE NULL END AS "winningAmount",
  a.bid_count AS "bidCount",
  a.opens_at AS "opensAt",
  a.closes_at AS "closesAt",
  a.closed_at AS "closedAt",
  a.awarded_at AS "awardedAt",
  a.published_at AS "publishedAt"
`;

export async function listPublicAuctions(limit: number, offset: number) {
  const [count, items] = await Promise.all([
    queryOne<{ total: string }>(
      `SELECT COUNT(*)::text AS total FROM auctions a
       WHERE a.published_at IS NOT NULL AND a.status IN ('scheduled', 'live', 'closed', 'under_review', 'awarded')`,
    ),
    queryAll<PublicAuctionRecord>(
      `SELECT ${PUBLIC_FIELDS}
       FROM auctions a JOIN organizations o ON o.id = a.org_id
       WHERE a.published_at IS NOT NULL AND a.status IN ('scheduled', 'live', 'closed', 'under_review', 'awarded')
       ORDER BY a.published_at DESC, a.id ASC
       LIMIT $1 OFFSET $2`,
      [limit, offset],
    ),
  ]);
  return { items, total: Number(count?.total ?? 0), limit, offset };
}

export async function listFinalizedBetween(start: Date, end: Date): Promise<PublicAuctionRecord[]> {
  return queryAll<PublicAuctionRecord>(
    `SELECT ${PUBLIC_FIELDS}
     FROM auctions a JOIN organizations o ON o.id = a.org_id
     WHERE a.published_at IS NOT NULL
       AND a.status IN ('closed', 'awarded')
       AND COALESCE(a.awarded_at, a.closed_at) >= $1
       AND COALESCE(a.awarded_at, a.closed_at) < $2
     ORDER BY COALESCE(a.awarded_at, a.closed_at) ASC, a.id ASC`,
    [start, end],
  );
}

/** Return the previous completed Monday-to-Monday UTC reporting window. */
export function previousWeek(now = new Date()) {
  const currentMonday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const daysSinceMonday = (currentMonday.getUTCDay() + 6) % 7;
  currentMonday.setUTCDate(currentMonday.getUTCDate() - daysSinceMonday);
  const end = currentMonday;
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 7);
  return { start, end };
}

export function toCsv(records: PublicAuctionRecord[]): string {
  const columns: Array<keyof PublicAuctionRecord> = [
    "id", "title", "organization", "type", "status", "region", "startPrice",
    "winningAmount", "bidCount", "opensAt", "closesAt", "closedAt", "awardedAt", "publishedAt",
  ];
  const cell = (value: unknown) => {
    let raw = value == null ? "" : value instanceof Date ? value.toISOString() : String(value);
    // Avoid spreadsheet formula execution when an exported field starts with
    // a formula marker. All cells are quoted and embedded quotes doubled.
    if (/^[\s]*[=+@-]/.test(raw)) raw = `'${raw}`;
    return `"${raw.replaceAll('"', '""')}"`;
  };
  return [columns.map(cell).join(","), ...records.map((record) => columns.map((column) => cell(record[column])).join(","))].join("\r\n");
}
