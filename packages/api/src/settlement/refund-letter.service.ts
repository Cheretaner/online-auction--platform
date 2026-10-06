import { randomUUID } from "node:crypto";
import { query, queryAll, queryOne } from "../infrastructure/database/query.js";
import { AppError } from "../shared/errors/index.js";

export async function issueRefundLetters(auctionId: string, winnerId: string | null, signedBy: string): Promise<void> {
  const deposits = await queryAll<{ id: string; bidder_id: string; amount: string }>(
    `SELECT id, bidder_id, amount FROM deposits
     WHERE auction_id = $1 AND status = 'verified' AND instrument_type IN ('cpo', 'bank_guarantee')
       AND ($2::uuid IS NULL OR bidder_id <> $2)`,
    [auctionId, winnerId],
  );
  for (const deposit of deposits) {
    const number = `REF-${new Date().getUTCFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`;
    const body = `Refund authorization for auction ${auctionId}. Deposit amount: ETB ${deposit.amount}. Present this signed and stamped letter at the issuing bank for collection.`;
    await query(
      `INSERT INTO refund_letters (auction_id, bidder_id, deposit_id, letter_number, body, official_stamp, signed_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (auction_id, bidder_id) DO NOTHING`,
      [auctionId, deposit.bidder_id, deposit.id, number, body, "OFFICIAL AUCTION ORGANIZATION STAMP", signedBy],
    );
  }
}

export async function listMine(bidderId: string) {
  return queryAll(
    `SELECT id, auction_id AS "auctionId", letter_number AS "letterNumber", body,
      official_stamp AS "officialStamp", created_at AS "createdAt"
     FROM refund_letters WHERE bidder_id = $1 ORDER BY created_at DESC`,
    [bidderId],
  );
}

export async function getMine(id: string, bidderId: string) {
  const letter = await queryOne(
    `SELECT letter_number AS "letterNumber", body, official_stamp AS "officialStamp"
     FROM refund_letters WHERE id = $1 AND bidder_id = $2`,
    [id, bidderId],
  );
  if (!letter) throw AppError.notFound("Refund letter not found");
  return letter;
}
