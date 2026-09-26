import { query, queryOne, queryAll } from "../infrastructure/database/query.js";
import { AppError, HttpStatus } from "../shared/errors/index.js";
import type { Auction } from "./auction.types.js";
import type { AuctionStatus } from "@auction/shared";
import type { CreateAuctionRequest, UpdateAuctionRequest } from "@auction/shared";
import type { Queryable } from "../infrastructure/database/query.js";

function mapRowToAuction(row: any): Auction {
  return {
    id: row.id,
    orgId: row.org_id,
    title: row.title,
    description: row.description,
    auctionType: row.auction_type,
    status: row.status,
    startPrice: row.start_price,
    reservePrice: row.reserve_price,
    minIncrement: row.min_increment,
    currentHighestBid: row.current_highest_bid,
    bidCount: row.bid_count,
    depositAmount: row.deposit_amount,
    eligibilityRules: row.eligibility_rules,
    region: row.region,
    antiSnipeSeconds: row.anti_snipe_seconds ?? 120,
    maxExtensions: row.max_extensions ?? 5,
    sealedOpenedAt: row.sealed_opened_at ?? null,
    closedAt: row.closed_at ?? null,
    awardedAt: row.awarded_at ?? null,
    cancellationReason: row.cancellation_reason ?? null,
    opensAt: row.opens_at,
    closesAt: row.closes_at,
    originalClosesAt: row.original_closes_at,
    extensionCount: row.extension_count,
    createdBy: row.created_by,
    approvedBy: row.approved_by,
    winnerId: row.winner_id,
    winningAmount: row.winning_amount,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function createAuction(
  orgId: string,
  createdBy: string,
  data: CreateAuctionRequest,
  client?: Queryable
): Promise<Auction> {
  const sql = `
    INSERT INTO auctions (
      org_id, title, description, auction_type, start_price, 
      reserve_price, min_increment, deposit_amount, 
      eligibility_rules, region, opens_at, closes_at, original_closes_at,
      created_by, status
    ) VALUES (
      $1, $2, $3, $4, $5, 
      $6, $7, $8, 
      $9, $10, $11, $12, $13,
      $14, 'draft'
    ) RETURNING *
  `;
  
  const values = [
    orgId,
    data.title,
    data.description ?? null,
    data.auctionType,
    data.startPrice,
    data.reservePrice ?? null,
    data.minIncrement,
    data.depositAmount ?? "0.00",
    data.eligibilityRules || null,
    data.region || null,
    data.opensAt,
    data.closesAt,
    data.closesAt, // original_closes_at
    createdBy,
  ];

  const row = await queryOne(sql, values, client);
  if (!row) throw new AppError("Failed to create auction", HttpStatus.INTERNAL_SERVER_ERROR);
  return mapRowToAuction(row);
}

export async function findById(id: string, client?: Queryable): Promise<Auction | null> {
  const sql = `SELECT * FROM auctions WHERE id = $1`;
  const row = await queryOne(sql, [id], client);
  return row ? mapRowToAuction(row) : null;
}

export async function updateAuction(
  id: string,
  data: UpdateAuctionRequest,
  client?: Queryable
): Promise<Auction> {
  const updates: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (data.title !== undefined) {
    updates.push(`title = $${paramIndex++}`);
    values.push(data.title);
  }
  if (data.description !== undefined) {
    updates.push(`description = $${paramIndex++}`);
    values.push(data.description);
  }
  if (data.startPrice !== undefined) {
    updates.push(`start_price = $${paramIndex++}`);
    values.push(data.startPrice);
  }
  if (data.reservePrice !== undefined) {
    updates.push(`reserve_price = $${paramIndex++}`);
    values.push(data.reservePrice);
  }
  if (data.minIncrement !== undefined) {
    updates.push(`min_increment = $${paramIndex++}`);
    values.push(data.minIncrement);
  }
  if (data.depositAmount !== undefined) {
    updates.push(`deposit_amount = $${paramIndex++}`);
    values.push(data.depositAmount);
  }
  if (data.eligibilityRules !== undefined) {
    updates.push(`eligibility_rules = $${paramIndex++}`);
    values.push(data.eligibilityRules);
  }
  if (data.region !== undefined) {
    updates.push(`region = $${paramIndex++}`);
    values.push(data.region);
  }
  if (data.opensAt !== undefined) {
    updates.push(`opens_at = $${paramIndex++}`);
    values.push(data.opensAt);
  }
  if (data.closesAt !== undefined) {
    updates.push(`closes_at = $${paramIndex++}`);
    updates.push(`original_closes_at = $${paramIndex++}`);
    values.push(data.closesAt);
    values.push(data.closesAt);
  }

  if (updates.length === 0) {
    const auction = await findById(id, client);
    if (!auction) throw new AppError("Auction not found", HttpStatus.NOT_FOUND);
    return auction;
  }

  updates.push(`updated_at = NOW()`);
  values.push(id);

  const sql = `
    UPDATE auctions 
    SET ${updates.join(", ")}
    WHERE id = $${paramIndex}
    RETURNING *
  `;

  const row = await queryOne(sql, values, client);
  if (!row) throw new AppError("Auction not found", HttpStatus.NOT_FOUND);
  return mapRowToAuction(row);
}

export async function updateStatus(
  id: string,
  status: AuctionStatus,
  approvedBy?: string | null,
  client?: Queryable
): Promise<Auction> {
  let sql = `UPDATE auctions SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`;
  let values: any[] = [status, id];

  if (approvedBy !== undefined) {
    sql = `UPDATE auctions SET status = $1, approved_by = $2, updated_at = NOW() WHERE id = $3 RETURNING *`;
    values = [status, approvedBy, id];
  }

  const row = await queryOne(sql, values, client);
  if (!row) throw new AppError("Auction not found", HttpStatus.NOT_FOUND);
  return mapRowToAuction(row);
}

export interface PublicAuctionFilters {
  q?: string;
  status?: AuctionStatus;
  categoryId?: string;
  orgId?: string;
  region?: string;
  limit: number;
  offset: number;
}

/** One page of the public catalogue plus the total match count, so clients
 * can page without downloading every auction. */
export async function listPublicAuctions(
  filters: PublicAuctionFilters,
  client?: Queryable,
): Promise<{ items: Auction[]; total: number }> {
  const where: string[] = [`a.status IN ('scheduled', 'live', 'closed', 'under_review', 'awarded')`];
  const values: unknown[] = [];
  const param = (value: unknown) => {
    values.push(value);
    return `$${values.length}`;
  };

  if (filters.status) where.push(`a.status = ${param(filters.status)}`);
  if (filters.orgId) where.push(`a.org_id = ${param(filters.orgId)}`);
  if (filters.region) where.push(`a.region ILIKE ${param(filters.region)}`);
  if (filters.q) {
    const pattern = param(`%${filters.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
    where.push(`(a.title ILIKE ${pattern} OR a.description ILIKE ${pattern})`);
  }
  if (filters.categoryId) {
    where.push(
      `EXISTS (SELECT 1 FROM auction_items i WHERE i.auction_id = a.id AND i.category_id = ${param(filters.categoryId)})`,
    );
  }

  const whereSql = where.join(" AND ");
  const countRow = await queryOne<{ total: string }>(
    `SELECT count(*)::text AS total FROM auctions a WHERE ${whereSql}`,
    values,
    client,
  );

  const limit = param(filters.limit);
  const offset = param(filters.offset);
  const rows = await queryAll(
    `SELECT a.* FROM auctions a
      WHERE ${whereSql}
      ORDER BY
        CASE a.status WHEN 'live' THEN 0 WHEN 'scheduled' THEN 1 ELSE 2 END,
        a.closes_at ASC,
        a.id ASC
      LIMIT ${limit} OFFSET ${offset}`,
    values,
    client,
  );
  return { items: rows.map(mapRowToAuction), total: Number(countRow?.total ?? 0) };
}

/** Locks a single auction row for the duration of the current transaction. */
export async function lockById(id: string, client?: Queryable): Promise<Auction | null> {
  const row = await queryOne(`SELECT * FROM auctions WHERE id = $1 FOR UPDATE`, [id], client);
  return row ? mapRowToAuction(row) : null;
}

/** Scheduled auctions whose opening time has passed. */
export async function findDueToOpen(now: Date, limit = 50, client?: Queryable): Promise<Auction[]> {
  const rows = await queryAll(
    `SELECT * FROM auctions
      WHERE status = 'scheduled' AND opens_at <= $1
      ORDER BY opens_at ASC
      LIMIT $2`,
    [now, limit],
    client,
  );
  return rows.map(mapRowToAuction);
}

/** Live auctions whose closing time has passed (including any extensions). */
export async function findDueToClose(now: Date, limit = 50, client?: Queryable): Promise<Auction[]> {
  const rows = await queryAll(
    `SELECT * FROM auctions
      WHERE status = 'live' AND closes_at <= $1
      ORDER BY closes_at ASC
      LIMIT $2`,
    [now, limit],
    client,
  );
  return rows.map(mapRowToAuction);
}

/**
 * Closes an auction and records the provisional outcome in the same
 * statement, so a crash between "closed" and "winner recorded" is not
 * possible. The status guard makes the update idempotent under concurrent
 * scheduler ticks.
 */
export async function closeWithOutcome(
  id: string,
  outcome: { winnerId: string | null; winningAmount: string | null },
  client?: Queryable,
): Promise<Auction | null> {
  const row = await queryOne(
    `UPDATE auctions
        SET status = 'closed',
            closed_at = NOW(),
            winner_id = $2,
            winning_amount = $3,
            updated_at = NOW()
      WHERE id = $1 AND status = 'live'
      RETURNING *`,
    [id, outcome.winnerId, outcome.winningAmount],
    client,
  );
  return row ? mapRowToAuction(row) : null;
}

/** Publishes a scheduled auction. Idempotent: only acts on 'scheduled'. */
export async function markLive(id: string, client?: Queryable): Promise<Auction | null> {
  const row = await queryOne(
    `UPDATE auctions
        SET status = 'live',
            published_at = COALESCE(published_at, NOW()),
            updated_at = NOW()
      WHERE id = $1 AND status = 'scheduled'
      RETURNING *`,
    [id],
    client,
  );
  return row ? mapRowToAuction(row) : null;
}

/** Moves an auction to under_review. Idempotent and safe to call twice. */
export async function markUnderReview(id: string, client?: Queryable): Promise<Auction | null> {
  const row = await queryOne(
    `UPDATE auctions
        SET status = 'under_review', updated_at = NOW()
      WHERE id = $1 AND status IN ('live', 'closed')
      RETURNING *`,
    [id],
    client,
  );
  return row ? mapRowToAuction(row) : null;
}

export async function markCancelled(
  id: string,
  reason: string | null,
  client?: Queryable,
): Promise<Auction | null> {
  const row = await queryOne(
    `UPDATE auctions
        SET status = 'cancelled', cancellation_reason = $2, updated_at = NOW()
      WHERE id = $1
      RETURNING *`,
    [id, reason],
    client,
  );
  return row ? mapRowToAuction(row) : null;
}

export async function markAwarded(id: string, client?: Queryable): Promise<Auction | null> {
  const row = await queryOne(
    `UPDATE auctions
        SET status = 'awarded', awarded_at = NOW(), updated_at = NOW()
      WHERE id = $1
      RETURNING *`,
    [id],
    client,
  );
  return row ? mapRowToAuction(row) : null;
}

export async function listByOrgId(orgId: string, client?: Queryable): Promise<Auction[]> {
  const sql = `
    SELECT * FROM auctions 
    WHERE org_id = $1
    ORDER BY created_at DESC
  `;
  const rows = await queryAll(sql, [orgId], client);
  return rows.map(mapRowToAuction);
}
