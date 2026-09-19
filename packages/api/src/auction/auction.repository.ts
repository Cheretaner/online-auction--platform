import { query, queryOne, queryAll } from "../infrastructure/database/query.js";
import { AppError, HttpStatus } from "../shared/errors/index.js";
import type { Auction } from "./auction.types.js";
import type { AuctionStatus } from "@auction/shared";
import type { CreateAuctionRequest, UpdateAuctionRequest } from "@auction/shared";
import type { ClientBase } from "pg";

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
  client?: ClientBase
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
    data.description || null,
    data.auctionType,
    data.startPrice,
    data.reservePrice || null,
    data.minIncrement,
    data.depositAmount || 0,
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

export async function findById(id: string, client?: ClientBase): Promise<Auction | null> {
  const sql = `SELECT * FROM auctions WHERE id = $1`;
  const row = await queryOne(sql, [id], client);
  return row ? mapRowToAuction(row) : null;
}

export async function updateAuction(
  id: string,
  data: UpdateAuctionRequest,
  client?: ClientBase
): Promise<Auction> {
  const updates: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (data.title !== undefined) {
    updates.push(`title = $\${paramIndex++}`);
    values.push(data.title);
  }
  if (data.description !== undefined) {
    updates.push(`description = $\${paramIndex++}`);
    values.push(data.description);
  }
  if (data.startPrice !== undefined) {
    updates.push(`start_price = $\${paramIndex++}`);
    values.push(data.startPrice);
  }
  if (data.reservePrice !== undefined) {
    updates.push(`reserve_price = $\${paramIndex++}`);
    values.push(data.reservePrice);
  }
  if (data.minIncrement !== undefined) {
    updates.push(`min_increment = $\${paramIndex++}`);
    values.push(data.minIncrement);
  }
  if (data.depositAmount !== undefined) {
    updates.push(`deposit_amount = $\${paramIndex++}`);
    values.push(data.depositAmount);
  }
  if (data.eligibilityRules !== undefined) {
    updates.push(`eligibility_rules = $\${paramIndex++}`);
    values.push(data.eligibilityRules);
  }
  if (data.region !== undefined) {
    updates.push(`region = $\${paramIndex++}`);
    values.push(data.region);
  }
  if (data.opensAt !== undefined) {
    updates.push(`opens_at = $\${paramIndex++}`);
    values.push(data.opensAt);
  }
  if (data.closesAt !== undefined) {
    updates.push(`closes_at = $\${paramIndex++}`);
    updates.push(`original_closes_at = $\${paramIndex++}`);
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
    SET \${updates.join(", ")}
    WHERE id = $\${paramIndex}
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
  client?: ClientBase
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

export async function listPublicAuctions(client?: ClientBase): Promise<Auction[]> {
  const sql = `
    SELECT * FROM auctions 
    WHERE status IN ('scheduled', 'live', 'closed', 'awarded')
    ORDER BY created_at DESC
  `;
  const rows = await queryAll(sql, [], client);
  return rows.map(mapRowToAuction);
}

export async function listByOrgId(orgId: string, client?: ClientBase): Promise<Auction[]> {
  const sql = `
    SELECT * FROM auctions 
    WHERE org_id = $1
    ORDER BY created_at DESC
  `;
  const rows = await queryAll(sql, [orgId], client);
  return rows.map(mapRowToAuction);
}
