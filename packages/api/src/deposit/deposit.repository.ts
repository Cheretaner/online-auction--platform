import { query } from "../infrastructure/database/query.js";
import type { Deposit } from "./deposit.types.js";

interface DbDeposit {
  id: string;
  user_id: string;
  auction_id: string;
  amount: string;
  status: Deposit["status"];
  created_at: Date;
}

function mapDeposit(row: DbDeposit): Deposit {
  return {
    id: row.id,
    userId: row.user_id,
    auctionId: row.auction_id,
    amount: row.amount,
    status: row.status,
    createdAt: row.created_at.toISOString(),
  };
}

export async function createDeposit(input: {
  userId: string;
  auctionId: string;
  amount: string;
}): Promise<Deposit> {
  const result = await query<DbDeposit>(
    `INSERT INTO deposits (user_id, auction_id, amount, status)
     VALUES ($1, $2, $3, 'held') RETURNING *`,
    [input.userId, input.auctionId, input.amount],
  );
  return mapDeposit(result.rows[0]);
}
