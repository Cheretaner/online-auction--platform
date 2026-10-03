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

export interface PublicAuctionListResponse {
  items: PublicAuctionRecord[];
  total: number;
  limit: number;
  offset: number;
}

interface PublicAuctionRow extends Omit<PublicAuctionRecord, "opensAt" | "closesAt" | "closedAt" | "awardedAt" | "publishedAt"> {
  opensAt: Date;
  closesAt: Date;
  closedAt: Date | null;
  awardedAt: Date | null;
  publishedAt: Date;
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

export async function listPublicAuctions(limit: number, offset: number): Promise<PublicAuctionListResponse> {
  const [count, items] = await Promise.all([
    queryOne<{ total: string }>(
      `SELECT COUNT(*)::text AS total FROM auctions a
       WHERE a.published_at IS NOT NULL AND a.status IN ('scheduled', 'live', 'closed', 'under_review', 'awarded')`,
    ),
    queryAll<PublicAuctionRow>(
      `SELECT ${PUBLIC_FIELDS}
       FROM auctions a JOIN organizations o ON o.id = a.org_id
       WHERE a.published_at IS NOT NULL AND a.status IN ('scheduled', 'live', 'closed', 'under_review', 'awarded')
       ORDER BY a.published_at DESC, a.id ASC
       LIMIT $1 OFFSET $2`,
      [limit, offset],
    ),
  ]);
  return {
    items: items.map((item) => ({
      ...item,
      opensAt: item.opensAt.toISOString(),
      closesAt: item.closesAt.toISOString(),
      closedAt: item.closedAt?.toISOString() ?? null,
      awardedAt: item.awardedAt?.toISOString() ?? null,
      publishedAt: item.publishedAt.toISOString(),
    })),
    total: Number(count?.total ?? 0),
    limit,
    offset,
  };
}
