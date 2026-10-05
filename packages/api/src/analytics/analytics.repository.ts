import { query, queryAll, queryOne } from "../infrastructure/database/query.js";
import type { Queryable } from "../infrastructure/database/query.js";

export interface AuctionAnalytics {
  region: string;
  categoryId: string;
  period: Date;
  auctionCount: number;
  uniqueBidders: number;
  totalBids: number;
  avgBidAmount: string;
  medianBidAmount: string;
  avgWinningAmount: string;
  avgReservePrice: string;
  avgReserveToWinningRatio: number;
  avgBidsPerAuction: number;
  successfulAuctions: number;
  cancelledAuctions: number;
}

export interface ReservePriceRecommendation {
  id: string;
  auctionId: string;
  categoryId: string | null;
  region: string | null;
  estimatedValue: string | null;
  recommendedReserve: string;
  confidenceScore: number;
  basedOnAuctions: number;
  calculationMethod: string;
  factors: Record<string, unknown>;
  createdAt: Date;
  createdBy: string | null;
}

export interface BidderParticipationMetrics {
  bidderId: string;
  period: Date;
  auctionsParticipated: number;
  totalBidsPlaced: number;
  auctionsWon: number;
  totalSpent: string;
  avgBidAmount: string | null;
  winRate: string | null;
  categoriesActive: string[];
  regionsActive: string[];
  updatedAt: Date;
}

interface DbAnalytics {
  region: string;
  category_id: string;
  period: Date;
  auction_count: number;
  unique_bidders: number;
  total_bids: number;
  avg_bid_amount: string;
  median_bid_amount: string;
  avg_winning_amount: string;
  avg_reserve_price: string;
  avg_reserve_to_winning_ratio: number;
  avg_bids_per_auction: number;
  successful_auctions: number;
  cancelled_auctions: number;
}

function mapAnalytics(row: DbAnalytics): AuctionAnalytics {
  return {
    region: row.region,
    categoryId: row.category_id,
    period: row.period,
    auctionCount: row.auction_count,
    uniqueBidders: row.unique_bidders,
    totalBids: row.total_bids,
    avgBidAmount: row.avg_bid_amount,
    medianBidAmount: row.median_bid_amount,
    avgWinningAmount: row.avg_winning_amount,
    avgReservePrice: row.avg_reserve_price,
    avgReserveToWinningRatio: row.avg_reserve_to_winning_ratio,
    avgBidsPerAuction: row.avg_bids_per_auction,
    successfulAuctions: row.successful_auctions,
    cancelledAuctions: row.cancelled_auctions,
  };
}

/**
 * Get historical analytics for a specific category and region
 */
export async function getHistoricalAnalytics(
  categoryId?: string,
  region?: string,
  months: number = 12,
  client?: Queryable,
): Promise<AuctionAnalytics[]> {
  const where: string[] = [];
  const values: unknown[] = [];

  if (categoryId) {
    values.push(categoryId);
    where.push(`category_id = $${values.length}`);
  }

  if (region) {
    values.push(region);
    where.push(`region = $${values.length}`);
  }

  values.push(months - 1);
  where.push(`period >= DATE_TRUNC('month', NOW()) - ($${values.length}::INT * INTERVAL '1 month')`);

  const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

  const rows = await queryAll<DbAnalytics>(
    `SELECT * FROM auction_analytics
     ${whereSql}
     ORDER BY period DESC, region, category_id`,
    values,
    client,
  );

  return rows.map(mapAnalytics);
}

/**
 * Get similar historical auctions for reserve price calculation
 */
export async function getSimilarHistoricalAuctions(
  categoryId?: string,
  region?: string,
  estimatedValue?: number,
  limit: number = 50,
  client?: Queryable,
): Promise<Array<{
  id: string;
  title: string;
  reservePrice: string;
  winningAmount: string | null;
  bidCount: number;
  estimatedValue: string | null;
  closedAt: Date;
}>> {
  const where: string[] = [
    "a.status IN ('awarded', 'closed')",
    "a.reserve_price IS NOT NULL",
    "a.reserve_price::numeric > 0",
    "a.closed_at IS NOT NULL",
    "a.closed_at >= NOW() - INTERVAL '2 years'", // Only last 2 years
  ];
  const values: unknown[] = [];

  if (categoryId) {
    values.push(categoryId);
    where.push(`EXISTS (SELECT 1 FROM auction_items ai WHERE ai.auction_id = a.id AND ai.category_id = $${values.length})`);
  }

  if (region) {
    values.push(region);
    where.push(`a.region = $${values.length}`);
  }

  // If estimated value provided, filter for similar value ranges (+/- 50%)
  if (estimatedValue) {
    const lower = estimatedValue * 0.5;
    const upper = estimatedValue * 1.5;
    values.push(lower, upper);
    where.push(`COALESCE((
      SELECT SUM(ai.estimated_value::numeric)
        FROM auction_items ai
       WHERE ai.auction_id = a.id
    ), 0) BETWEEN $${values.length - 1} AND $${values.length}`);
  }

  values.push(limit);
  const limitParam = `$${values.length}`;

  const rows = await queryAll<{
    id: string;
    title: string;
    reserve_price: string;
    winning_amount: string | null;
    bid_count: number;
    estimated_value: string | null;
    closed_at: Date;
  }>(
    `SELECT 
      a.id,
      a.title,
      a.reserve_price,
      a.winning_amount,
      a.bid_count,
      (SELECT SUM(ai.estimated_value::numeric) FROM auction_items ai WHERE ai.auction_id = a.id) as estimated_value,
      a.closed_at
     FROM auctions a
     WHERE ${where.join(" AND ")}
     ORDER BY a.closed_at DESC
     LIMIT ${limitParam}`,
    values,
    client,
  );

  return rows.map(row => ({
    id: row.id,
    title: row.title,
    reservePrice: row.reserve_price,
    winningAmount: row.winning_amount,
    bidCount: row.bid_count,
    estimatedValue: row.estimated_value,
    closedAt: row.closed_at,
  }));
}

/**
 * Save a reserve price recommendation
 */
export async function saveRecommendation(
  input: {
    auctionId: string;
    categoryId?: string;
    region?: string;
    estimatedValue?: string;
    recommendedReserve: string;
    confidenceScore: number;
    basedOnAuctions: number;
    calculationMethod: string;
    factors: Record<string, unknown>;
    createdBy?: string;
  },
  client?: Queryable,
): Promise<ReservePriceRecommendation> {
  const result = await query<{
    id: string;
    auction_id: string;
    category_id: string | null;
    region: string | null;
    estimated_value: string | null;
    recommended_reserve: string;
    confidence_score: number;
    based_on_auctions: number;
    calculation_method: string;
    factors: Record<string, unknown>;
    created_at: Date;
    created_by: string | null;
  }>(
    `INSERT INTO reserve_price_recommendations (
      auction_id, category_id, region, estimated_value,
      recommended_reserve, confidence_score, based_on_auctions,
      calculation_method, factors, created_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    ON CONFLICT (auction_id) DO UPDATE SET
      recommended_reserve = EXCLUDED.recommended_reserve,
      confidence_score = EXCLUDED.confidence_score,
      based_on_auctions = EXCLUDED.based_on_auctions,
      factors = EXCLUDED.factors,
      created_at = NOW()
    RETURNING *`,
    [
      input.auctionId,
      input.categoryId ?? null,
      input.region ?? null,
      input.estimatedValue ?? null,
      input.recommendedReserve,
      input.confidenceScore,
      input.basedOnAuctions,
      input.calculationMethod,
      JSON.stringify(input.factors),
      input.createdBy ?? null,
    ],
    client,
  );

  const row = result.rows[0];
  return {
    id: row.id,
    auctionId: row.auction_id,
    categoryId: row.category_id,
    region: row.region,
    estimatedValue: row.estimated_value,
    recommendedReserve: row.recommended_reserve,
    confidenceScore: row.confidence_score,
    basedOnAuctions: row.based_on_auctions,
    calculationMethod: row.calculation_method,
    factors: row.factors,
    createdAt: row.created_at,
    createdBy: row.created_by,
  };
}

/**
 * Get recommendation for an auction
 */
export async function getRecommendation(
  auctionId: string,
  client?: Queryable,
): Promise<ReservePriceRecommendation | null> {
  const row = await queryOne<{
    id: string;
    auction_id: string;
    category_id: string | null;
    region: string | null;
    estimated_value: string | null;
    recommended_reserve: string;
    confidence_score: number;
    based_on_auctions: number;
    calculation_method: string;
    factors: Record<string, unknown>;
    created_at: Date;
    created_by: string | null;
  }>(
    `SELECT * FROM reserve_price_recommendations WHERE auction_id = $1`,
    [auctionId],
    client,
  );

  if (!row) return null;

  return {
    id: row.id,
    auctionId: row.auction_id,
    categoryId: row.category_id,
    region: row.region,
    estimatedValue: row.estimated_value,
    recommendedReserve: row.recommended_reserve,
    confidenceScore: row.confidence_score,
    basedOnAuctions: row.based_on_auctions,
    calculationMethod: row.calculation_method,
    factors: row.factors,
    createdAt: row.created_at,
    createdBy: row.created_by,
  };
}

/**
 * Refresh the materialized view (called by scheduled job)
 */
export async function refreshAnalytics(client?: Queryable): Promise<void> {
  await query("SELECT refresh_auction_analytics()", [], client);
}

/**
 * Get bidder participation metrics
 */
export async function getBidderMetrics(
  bidderId: string,
  months: number = 6,
  client?: Queryable,
): Promise<BidderParticipationMetrics[]> {
  const rows = await queryAll<{
    bidder_id: string;
    period: Date;
    auctions_participated: number;
    total_bids_placed: number;
    auctions_won: number;
    total_spent: string;
    avg_bid_amount: string | null;
    win_rate: string | null;
    categories_active: string[];
    regions_active: string[];
    updated_at: Date;
  }>(
    `SELECT * FROM bidder_participation_metrics
     WHERE bidder_id = $1
       AND period >= DATE_TRUNC('month', NOW()) - ($2::INT * INTERVAL '1 month')
     ORDER BY period DESC`,
    [bidderId, months - 1],
    client,
  );

  return rows.map(row => ({
    bidderId: row.bidder_id,
    period: row.period,
    auctionsParticipated: row.auctions_participated,
    totalBidsPlaced: row.total_bids_placed,
    auctionsWon: row.auctions_won,
    totalSpent: row.total_spent,
    avgBidAmount: row.avg_bid_amount,
    winRate: row.win_rate,
    categoriesActive: row.categories_active,
    regionsActive: row.regions_active,
    updatedAt: row.updated_at,
  }));
}

/**
 * Update bidder participation metrics (called by scheduled job)
 */
export async function updateBidderMetrics(period: Date, client?: Queryable): Promise<void> {
  await query(
    `INSERT INTO bidder_participation_metrics (
      bidder_id, period, auctions_participated, total_bids_placed,
      auctions_won, total_spent, avg_bid_amount, win_rate,
      categories_active, regions_active
    )
    WITH active_bids AS (
      SELECT b.id, b.bidder_id, b.auction_id, b.amount, a.region, a.winner_id,
             DATE_TRUNC('month', b.placed_at)::DATE AS period
        FROM bids b
        JOIN auctions a ON a.id = b.auction_id
       WHERE b.status = 'active'
         AND DATE_TRUNC('month', b.placed_at) = DATE_TRUNC('month', $1)
    ),
    participation AS (
      SELECT bidder_id, period,
             COUNT(DISTINCT auction_id)::INT AS auctions_participated,
             COUNT(id)::INT AS total_bids_placed,
             COUNT(DISTINCT CASE WHEN winner_id = bidder_id THEN auction_id END)::INT AS auctions_won,
             AVG(amount::numeric) AS avg_bid_amount,
             CASE WHEN COUNT(DISTINCT auction_id) > 0
               THEN COUNT(DISTINCT CASE WHEN winner_id = bidder_id THEN auction_id END)::numeric
                    / COUNT(DISTINCT auction_id)::numeric * 100
               ELSE NULL
             END AS win_rate,
             ARRAY_AGG(DISTINCT region) FILTER (WHERE region IS NOT NULL) AS regions_active
        FROM active_bids
       GROUP BY bidder_id, period
    ),
    categories AS (
      SELECT ab.bidder_id, ab.period,
             ARRAY_AGG(DISTINCT ai.category_id::text) FILTER (WHERE ai.category_id IS NOT NULL) AS categories_active
        FROM (SELECT DISTINCT bidder_id, auction_id, period FROM active_bids) ab
        JOIN auction_items ai ON ai.auction_id = ab.auction_id
       GROUP BY ab.bidder_id, ab.period
    ),
    winner_spend AS (
      SELECT winner_id AS bidder_id, DATE_TRUNC('month', closed_at)::DATE AS period,
             SUM(winning_amount::numeric) AS total_spent
        FROM auctions
       WHERE winner_id IS NOT NULL
         AND winning_amount IS NOT NULL
         AND closed_at IS NOT NULL
         AND DATE_TRUNC('month', closed_at) = DATE_TRUNC('month', $1)
       GROUP BY winner_id, DATE_TRUNC('month', closed_at)::DATE
    )
    SELECT p.bidder_id, p.period, p.auctions_participated, p.total_bids_placed,
           p.auctions_won, COALESCE(ws.total_spent, 0) AS total_spent,
           p.avg_bid_amount, p.win_rate,
           COALESCE(c.categories_active, ARRAY[]::TEXT[]) AS categories_active,
           COALESCE(p.regions_active, ARRAY[]::TEXT[]) AS regions_active
      FROM participation p
      LEFT JOIN categories c ON c.bidder_id = p.bidder_id AND c.period = p.period
      LEFT JOIN winner_spend ws ON ws.bidder_id = p.bidder_id AND ws.period = p.period
    ON CONFLICT (bidder_id, period) DO UPDATE SET
      auctions_participated = EXCLUDED.auctions_participated,
      total_bids_placed = EXCLUDED.total_bids_placed,
      auctions_won = EXCLUDED.auctions_won,
      total_spent = EXCLUDED.total_spent,
      avg_bid_amount = EXCLUDED.avg_bid_amount,
      win_rate = EXCLUDED.win_rate,
      categories_active = EXCLUDED.categories_active,
      regions_active = EXCLUDED.regions_active,
      updated_at = NOW()`,
    [period],
    client,
  );
}
