import { query, queryAll, queryOne, type Queryable } from "../infrastructure/database/query.js";
import { env } from "../config/env.js";
import type { SettlementObligation, SettlementStatus } from "./settlement.types.js";

interface DbSettlement {
  id: string;
  auction_id: string;
  winner_id: string;
  amount: string;
  currency: "ETB";
  status: SettlementStatus;
  due_at: Date;
  paid_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

function mapSettlement(row: DbSettlement): SettlementObligation {
  return {
    id: row.id,
    auctionId: row.auction_id,
    winnerId: row.winner_id,
    amount: row.amount,
    currency: row.currency,
    status: row.status,
    dueAt: row.due_at.toISOString(),
    paidAt: row.paid_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function createForAward(input: {
  auctionId: string;
  winnerId: string;
  amount: string;
}, client?: Queryable): Promise<SettlementObligation> {
  const row = await queryOne<DbSettlement>(
    `INSERT INTO settlement_obligations (auction_id, winner_id, amount, due_at, status, paid_at, updated_at)
     VALUES ($1, $2, $3, NOW() + ($4 * INTERVAL '1 hour'), 'due', NULL, NOW())
     ON CONFLICT (auction_id) DO UPDATE SET
       winner_id = CASE
         WHEN settlement_obligations.status IN ('paid', 'payment_pending', 'reconciliation_required')
           THEN settlement_obligations.winner_id
         ELSE EXCLUDED.winner_id
       END,
       amount = CASE
         WHEN settlement_obligations.status IN ('paid', 'payment_pending', 'reconciliation_required')
           THEN settlement_obligations.amount
         ELSE EXCLUDED.amount
       END,
       status = CASE
         WHEN settlement_obligations.status IN ('paid', 'payment_pending', 'reconciliation_required')
           THEN settlement_obligations.status
         ELSE 'due'
       END,
       due_at = CASE
         WHEN settlement_obligations.status IN ('paid', 'payment_pending', 'reconciliation_required')
           THEN settlement_obligations.due_at
         ELSE NOW() + ($4 * INTERVAL '1 hour')
       END,
       paid_at = CASE
         WHEN settlement_obligations.status IN ('paid', 'payment_pending', 'reconciliation_required')
           THEN settlement_obligations.paid_at
         ELSE NULL
       END,
       updated_at = NOW()
     RETURNING *`,
    [input.auctionId, input.winnerId, input.amount, env.SETTLEMENT_DUE_HOURS],
    client,
  );
  if (!row) throw new Error("Failed to create settlement obligation");
  return mapSettlement(row);
}

export async function findByAuctionAndWinner(
  auctionId: string,
  winnerId: string,
  client?: Queryable,
): Promise<SettlementObligation | null> {
  const row = await queryOne<DbSettlement>(
    `SELECT * FROM settlement_obligations WHERE auction_id = $1 AND winner_id = $2`,
    [auctionId, winnerId],
    client,
  );
  return row ? mapSettlement(row) : null;
}

export async function lockByAuctionAndWinner(
  auctionId: string,
  winnerId: string,
  client: Queryable,
): Promise<SettlementObligation | null> {
  const row = await queryOne<DbSettlement>(
    `SELECT * FROM settlement_obligations WHERE auction_id = $1 AND winner_id = $2 FOR UPDATE`,
    [auctionId, winnerId],
    client,
  );
  return row ? mapSettlement(row) : null;
}

export async function findByWinner(winnerId: string): Promise<SettlementObligation[]> {
  const rows = await queryAll<DbSettlement>(
    `SELECT * FROM settlement_obligations WHERE winner_id = $1 ORDER BY created_at DESC`,
    [winnerId],
  );
  return rows.map(mapSettlement);
}

export async function markPaymentPending(id: string, client?: Queryable): Promise<void> {
  await query(
    `UPDATE settlement_obligations SET status = 'payment_pending', updated_at = NOW()
     WHERE id = $1 AND status IN ('due', 'payment_pending')`,
    [id],
    client,
  );
}