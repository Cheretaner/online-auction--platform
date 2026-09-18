import { query, queryOne } from "../infrastructure/database/query.js";
import type { AuctionStatus, AuctionType } from "@auction/shared";
import type { Auction } from "./auction.types.js";

interface DbAuction {
  id: string;
  org_id: string;
  title: string;
  description: string | null;
  auction_type: AuctionType;
  status: AuctionStatus;
  start_price: string;
  reserve_price: string | null;
  min_increment: string;
  deposit_amount: string;
  current_highest_bid: string;
  bid_count: number;
  opens_at: Date;
  closes_at: Date;
  original_closes_at: Date;
  extension_count: number;
  anti_snipe_seconds: number | null;
  max_extensions: number | null;
  created_by: string;
  approved_by: string | null;
  winner_id: string | null;
  winning_amount: string | null;
  sealed_opened_at: Date | null;
  published_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

function mapAuction(row: DbAuction): Auction {
  return {
    id: row.id,
    orgId: row.org_id,
    title: row.title,
    description: row.description ?? undefined,
    auctionType: row.auction_type,
    status: row.status,
    startPrice: row.start_price,
    reservePrice: row.reserve_price,
    minIncrement: row.min_increment,
    depositAmount: row.deposit_amount,
    currentHighestBid: row.current_highest_bid,
    bidCount: row.bid_count,
    opensAt: row.opens_at.toISOString(),
    closesAt: row.closes_at.toISOString(),
    originalClosesAt: row.original_closes_at.toISOString(),
    extensionCount: row.extension_count,
    antiSnipeSeconds: row.anti_snipe_seconds ?? 120,
    maxExtensions: row.max_extensions ?? 5,
    createdBy: row.created_by,
    approvedBy: row.approved_by ?? undefined,
    winnerId: row.winner_id ?? undefined,
    winningAmount: row.winning_amount ?? undefined,
    sealedOpenedAt: row.sealed_opened_at?.toISOString(),
    publishedAt: row.published_at?.toISOString(),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function createAuction(input: {
  organizationId: string;
  title: string;
  description?: string;
  auctionType: AuctionType;
  startingPrice: string;
  reservePrice?: string;
  minIncrement: string;
  depositAmount: string;
  opensAt: string;
  closesAt: string;
  antiSnipeSeconds: number;
  maxExtensions: number;
  createdBy: string;
}): Promise<Auction> {
  const result = await query<DbAuction>(
    `INSERT INTO auctions (
        org_id, title, description, auction_type,
        start_price, reserve_price, min_increment, deposit_amount,
        opens_at, closes_at, original_closes_at,
        anti_snipe_seconds, max_extensions, created_by
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10, $11, $12, $13)
     RETURNING *`,
    [
      input.organizationId,
      input.title,
      input.description ?? null,
      input.auctionType,
      input.startingPrice,
      input.reservePrice ?? null,
      input.minIncrement,
      input.depositAmount,
      input.opensAt,
      input.closesAt,
      input.antiSnipeSeconds,
      input.maxExtensions,
      input.createdBy,
    ],
  );
  return mapAuction(result.rows[0]);
}

export async function findAuctionById(id: string): Promise<Auction | null> {
  const row = await queryOne<DbAuction>("SELECT * FROM auctions WHERE id = $1", [id]);
  return row ? mapAuction(row) : null;
}

export async function updateAuctionStatus(id: string, status: AuctionStatus): Promise<Auction> {
  const result = await query<DbAuction>(
    "UPDATE auctions SET status = $2, updated_at = NOW() WHERE id = $1 RETURNING *",
    [id, status],
  );
  return mapAuction(result.rows[0]);
}
