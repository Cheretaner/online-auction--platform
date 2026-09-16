import { query } from "../infrastructure/database/query.js";
import type { Bid } from "./bidding.types.js";

interface DbBid {
  id: string;
  auction_id: string;
  bidder_id: string;
  amount: string;
  placed_at: Date;
}

function mapBid(row: DbBid): Bid {
  return {
    id: row.id,
    auctionId: row.auction_id,
    bidderId: row.bidder_id,
    amount: row.amount,
    placedAt: row.placed_at.toISOString(),
  };
}

export async function insertBid(input: {
  auctionId: string;
  bidderId: string;
  amount: string;
  idempotencyKey?: string;
}): Promise<Bid> {
  const result = await query<DbBid>(
    `INSERT INTO bids (auction_id, bidder_id, amount, idempotency_key)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [input.auctionId, input.bidderId, input.amount, input.idempotencyKey ?? null],
  );

  await query(
    `UPDATE auctions
     SET current_highest_bid = $2, bid_count = bid_count + 1, updated_at = NOW()
     WHERE id = $1`,
    [input.auctionId, input.amount],
  );

  return mapBid(result.rows[0]);
}
