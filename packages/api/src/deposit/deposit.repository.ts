import type { DepositStatus, InstrumentType } from "@auction/shared";
import { query, queryOne, queryAll } from "../infrastructure/database/query.js";
import type { Deposit } from "./deposit.types.js";

interface DbDeposit {
  id: string;
  auction_id: string;
  bidder_id: string;
  amount: string;
  reference_number: string;
  issuing_bank: string;
  instrument_type: InstrumentType;
  document_id: string | null;
  status: DepositStatus;
  verified_by: string | null;
  verified_at: Date | null;
  released_at: Date | null;
  rejection_reason: string | null;
  created_at: Date;
  updated_at: Date;
}

function mapDeposit(row: DbDeposit): Deposit {
  return {
    id: row.id,
    auctionId: row.auction_id,
    bidderId: row.bidder_id,
    amount: row.amount,
    referenceNumber: row.reference_number,
    issuingBank: row.issuing_bank,
    instrumentType: row.instrument_type,
    documentId: row.document_id,
    status: row.status,
    verifiedBy: row.verified_by,
    verifiedAt: row.verified_at?.toISOString() ?? null,
    releasedAt: row.released_at?.toISOString() ?? null,
    rejectionReason: row.rejection_reason,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function createDeposit(input: {
  auctionId: string;
  bidderId: string;
  amount: string;
  referenceNumber: string;
  issuingBank: string;
  instrumentType: InstrumentType;
  documentId?: string;
}): Promise<Deposit> {
  const result = await query<DbDeposit>(
    `INSERT INTO deposits (auction_id, bidder_id, amount, reference_number, issuing_bank, instrument_type, document_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [input.auctionId, input.bidderId, input.amount, input.referenceNumber, input.issuingBank, input.instrumentType, input.documentId ?? null],
  );
  return mapDeposit(result.rows[0]);
}

export async function findById(id: string): Promise<Deposit | null> {
  const row = await queryOne<DbDeposit>("SELECT * FROM deposits WHERE id = $1", [id]);
  return row ? mapDeposit(row) : null;
}

export async function findByAuctionAndBidder(auctionId: string, bidderId: string): Promise<Deposit | null> {
  const row = await queryOne<DbDeposit>("SELECT * FROM deposits WHERE auction_id = $1 AND bidder_id = $2", [auctionId, bidderId]);
  return row ? mapDeposit(row) : null;
}

export async function findByAuction(auctionId: string): Promise<Deposit[]> {
  const rows = await queryAll<DbDeposit>("SELECT * FROM deposits WHERE auction_id = $1 ORDER BY created_at DESC", [auctionId]);
  return rows.map(mapDeposit);
}

export async function findByBidder(bidderId: string): Promise<Deposit[]> {
  const rows = await queryAll<DbDeposit>(
    "SELECT * FROM deposits WHERE bidder_id = $1 ORDER BY created_at DESC",
    [bidderId],
  );
  return rows.map(mapDeposit);
}

export async function updateStatus(
  id: string,
  status: DepositStatus,
  extra?: { verifiedBy?: string; verifiedAt?: Date; releasedAt?: Date; rejectionReason?: string },
): Promise<Deposit> {
  const result = await query<DbDeposit>(
    `UPDATE deposits
     SET status = $2, verified_by = COALESCE($3, verified_by), verified_at = COALESCE($4, verified_at),
         released_at = COALESCE($5, released_at), rejection_reason = COALESCE($6, rejection_reason),
         updated_at = NOW()
     WHERE id = $1 RETURNING *`,
    [id, status, extra?.verifiedBy ?? null, extra?.verifiedAt ?? null, extra?.releasedAt ?? null, extra?.rejectionReason ?? null],
  );
  return mapDeposit(result.rows[0]);
}
