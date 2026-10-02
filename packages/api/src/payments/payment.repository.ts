import { query, queryAll, queryOne, type Queryable } from "../infrastructure/database/query.js";

export interface ProviderTransaction {
  id: string;
  depositId: string | null;
  settlementId: string | null;
  txRef: string;
  amount: string;
  status:
    | "initializing"
    | "pending"
    | "succeeded"
    | "failed"
    | "refund_pending"
    | "refunded"
    | "reconciliation_required";
  providerReference: string | null;
  checkoutUrl: string | null;
}

interface DbProviderTransaction {
  id: string;
  deposit_id: string | null;
  settlement_id: string | null;
  tx_ref: string;
  amount: string;
  status: ProviderTransaction["status"];
  provider_reference: string | null;
  checkout_url: string | null;
}

function mapTransaction(row: DbProviderTransaction): ProviderTransaction {
  return {
    id: row.id,
    depositId: row.deposit_id,
    settlementId: row.settlement_id,
    txRef: row.tx_ref,
    amount: row.amount,
    status: row.status,
    providerReference: row.provider_reference,
    checkoutUrl: row.checkout_url,
  };
}

export async function create(input: {
  depositId?: string;
  settlementId?: string;
  txRef: string;
  amount: string;
}, client?: Queryable): Promise<ProviderTransaction> {
  const result = await query<DbProviderTransaction>(
    `INSERT INTO provider_transactions (provider, deposit_id, settlement_id, tx_ref, amount, status)
     VALUES ('chapa', $1, $2, $3, $4, 'initializing') RETURNING *`,
    [input.depositId ?? null, input.settlementId ?? null, input.txRef, input.amount],
    client,
  );
  return mapTransaction(result.rows[0]);
}

export async function findLatestForDeposit(depositId: string, client?: Queryable): Promise<ProviderTransaction | null> {
  const row = await queryOne<DbProviderTransaction>(
    `SELECT * FROM provider_transactions WHERE deposit_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [depositId],
    client,
  );
  return row ? mapTransaction(row) : null;
}

export async function findLatestForSettlement(settlementId: string, client?: Queryable): Promise<ProviderTransaction | null> {
  const row = await queryOne<DbProviderTransaction>(
    `SELECT * FROM provider_transactions WHERE settlement_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [settlementId],
    client,
  );
  return row ? mapTransaction(row) : null;
}

export async function findByTxRef(txRef: string, client?: Queryable): Promise<ProviderTransaction | null> {
  const row = await queryOne<DbProviderTransaction>(
    `SELECT * FROM provider_transactions WHERE tx_ref = $1`,
    [txRef],
    client,
  );
  return row ? mapTransaction(row) : null;
}

export async function saveCheckoutUrl(id: string, checkoutUrl: string, client?: Queryable): Promise<void> {
  await query(
    `UPDATE provider_transactions SET checkout_url = $2, status = 'pending', updated_at = NOW()
     WHERE id = $1 AND status = 'initializing'`,
    [id, checkoutUrl],
    client,
  );
}

export async function markInitializationFailed(id: string, client?: Queryable): Promise<void> {
  await query(
    `UPDATE provider_transactions SET status = 'failed', updated_at = NOW()
     WHERE id = $1 AND status = 'initializing'`,
    [id],
    client,
  );
}

export async function findPaymentOwnerByTxRef(txRef: string): Promise<{ bidderId: string } | null> {
  return queryOne<{ bidderId: string }>(
    `SELECT COALESCE(d.bidder_id, s.winner_id) AS "bidderId"
       FROM provider_transactions pt
       LEFT JOIN deposits d ON d.id = pt.deposit_id
       LEFT JOIN settlement_obligations s ON s.id = pt.settlement_id
      WHERE pt.tx_ref = $1`,
    [txRef],
  );
}

export interface ProviderRefund {
  id: string;
  transactionId: string;
  depositId: string;
  bidderId: string;
  auctionId: string;
  txRef: string;
  merchantReference: string;
  providerReference: string | null;
  amount: string;
  status: "requested" | "initiated" | "processing" | "refunded" | "reversed" | "failed" | "reconciliation_required";
  reason: string;
}

interface DbProviderRefund {
  id: string;
  provider_transaction_id: string;
  deposit_id: string;
  bidder_id: string;
  auction_id: string;
  tx_ref: string;
  merchant_reference: string;
  provider_reference: string | null;
  amount: string;
  status: ProviderRefund["status"];
  reason: string;
}

function mapRefund(row: DbProviderRefund): ProviderRefund {
  return {
    id: row.id,
    transactionId: row.provider_transaction_id,
    depositId: row.deposit_id,
    bidderId: row.bidder_id,
    auctionId: row.auction_id,
    txRef: row.tx_ref,
    merchantReference: row.merchant_reference,
    providerReference: row.provider_reference,
    amount: row.amount,
    status: row.status,
    reason: row.reason,
  };
}

export async function listRefundableDeposits(auctionId: string, winnerId: string | null): Promise<Array<{
  transactionId: string;
  depositId: string;
  bidderId: string;
  txRef: string;
  amount: string;
}>> {
  const rows = await queryAll<{
    transaction_id: string;
    deposit_id: string;
    bidder_id: string;
    tx_ref: string;
    amount: string;
  }>(
    `SELECT pt.id AS transaction_id, d.id AS deposit_id, d.bidder_id,
            pt.tx_ref, pt.amount
       FROM deposits d
       JOIN provider_transactions pt ON pt.deposit_id = d.id
      WHERE d.auction_id = $1
        AND d.instrument_type = 'chapa'
        AND d.provider_verified = TRUE
        AND d.status = 'verified'
        AND pt.status = 'succeeded'
        AND ($2::uuid IS NULL OR d.bidder_id <> $2)
      ORDER BY d.created_at`,
    [auctionId, winnerId],
  );
  return rows.map((row) => ({
    transactionId: row.transaction_id,
    depositId: row.deposit_id,
    bidderId: row.bidder_id,
    txRef: row.tx_ref,
    amount: row.amount,
  }));
}

export async function createOrGetRefund(input: {
  transactionId: string;
  depositId: string;
  merchantReference: string;
  amount: string;
  reason: string;
}): Promise<ProviderRefund> {
  const row = await queryOne<DbProviderRefund>(
    `INSERT INTO provider_refunds (
       provider_transaction_id, deposit_id, merchant_reference, amount, reason,
       bidder_id, auction_id, tx_ref
     )
     SELECT $1, d.id, $3, $4, $5, d.bidder_id, d.auction_id, pt.tx_ref
       FROM deposits d JOIN provider_transactions pt ON pt.deposit_id = d.id
      WHERE d.id = $2 AND pt.id = $1
     ON CONFLICT (provider_transaction_id) DO UPDATE SET provider_transaction_id = EXCLUDED.provider_transaction_id
     RETURNING *`,
    [input.transactionId, input.depositId, input.merchantReference, input.amount, input.reason],
  );
  if (!row) throw new Error("Failed to create provider refund record");
  return mapRefund(row);
}

export async function findRefundsForAuction(auctionId: string): Promise<ProviderRefund[]> {
  const rows = await queryAll<DbProviderRefund>(
    `SELECT * FROM provider_refunds WHERE auction_id = $1 ORDER BY created_at`,
    [auctionId],
  );
  return rows.map(mapRefund);
}

export async function markRefundInitiated(id: string, providerReference: string): Promise<void> {
  await query(
    `UPDATE provider_refunds SET status = 'initiated', provider_reference = $2, updated_at = NOW()
      WHERE id = $1 AND status = 'requested'`,
    [id, providerReference],
  );
}

export async function findRefundsToReconcile(limit = 50): Promise<ProviderRefund[]> {
  const rows = await queryAll<DbProviderRefund>(
    `SELECT * FROM provider_refunds
      WHERE status IN ('initiated', 'processing')
      ORDER BY created_at LIMIT $1`,
    [limit],
  );
  return rows.map(mapRefund);
}

export async function updateRefundStatus(id: string, status: ProviderRefund["status"]): Promise<void> {
  await query(
    `UPDATE provider_refunds SET status = $2, last_checked_at = NOW(), updated_at = NOW() WHERE id = $1`,
    [id, status],
  );
}
