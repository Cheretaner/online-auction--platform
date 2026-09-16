import type { AuctionStatus } from "@auction/shared";
import { query } from "../infrastructure/database/query.js";
import type { Auction } from "./auction.types.js";

interface DbAuction {
  id: string;
  organization_id: string;
  title: string;
  description: string | null;
  status: AuctionStatus;
  starting_price: string;
  current_highest_bid: string | null;
  bid_count: number;
  opens_at: Date | null;
  closes_at: Date | null;
  created_by: string;
  created_at: Date;
}

function mapAuction(row: DbAuction): Auction {
  return {
    id: row.id,
    organizationId: row.organization_id,
    title: row.title,
    description: row.description ?? undefined,
    status: row.status,
    startingPrice: row.starting_price,
    currentHighestBid: row.current_highest_bid ?? undefined,
    bidCount: row.bid_count,
    opensAt: row.opens_at?.toISOString(),
    closesAt: row.closes_at?.toISOString(),
    createdBy: row.created_by,
    createdAt: row.created_at.toISOString(),
  };
}

export async function createAuction(input: {
  organizationId: string;
  title: string;
  description?: string;
  startingPrice: string;
  createdBy: string;
}): Promise<Auction> {
  const result = await query<DbAuction>(
    `INSERT INTO auctions (organization_id, title, description, starting_price, created_by)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [input.organizationId, input.title, input.description ?? null, input.startingPrice, input.createdBy],
  );
  return mapAuction(result.rows[0]);
}

export async function findAuctionById(id: string): Promise<Auction | null> {
  const result = await query<DbAuction>("SELECT * FROM auctions WHERE id = $1", [id]);
  return result.rows[0] ? mapAuction(result.rows[0]) : null;
}

export async function updateAuctionStatus(id: string, status: AuctionStatus): Promise<Auction> {
  const result = await query<DbAuction>(
    "UPDATE auctions SET status = $2, updated_at = NOW() WHERE id = $1 RETURNING *",
    [id, status],
  );
  return mapAuction(result.rows[0]);
}
