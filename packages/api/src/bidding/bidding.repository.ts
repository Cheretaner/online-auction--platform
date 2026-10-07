import { query, queryAll, queryOne } from "../infrastructure/database/query.js";
import type { AuctionLockSnapshot, BidRecord, BidderSnapshot } from "./bidding.types.js";

interface DbAuctionLock {
  id: string;
  org_id: string;
  title: string;
  auction_type: AuctionLockSnapshot["auctionType"];
  status: string;
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
  sealed_opened_at: Date | null;
}

interface DbBid {
  id: string;
  auction_id: string;
  bidder_id: string;
  amount: string;
  status: BidRecord["status"];
  is_sealed: boolean;
  commitment_hash: string | null;
  placed_at: Date;
  idempotency_key: string;
  withdrawn_at: Date | null;
  withdrawal_reason: string | null;
}

function mapAuction(row: DbAuctionLock): AuctionLockSnapshot {
  return {
    id: row.id,
    orgId: row.org_id,
    title: row.title,
    auctionType: row.auction_type,
    status: row.status,
    startPrice: row.start_price,
    reservePrice: row.reserve_price,
    minIncrement: row.min_increment,
    depositAmount: row.deposit_amount,
    currentHighestBid: row.current_highest_bid,
    bidCount: row.bid_count,
    opensAt: row.opens_at,
    closesAt: row.closes_at,
    originalClosesAt: row.original_closes_at,
    extensionCount: row.extension_count,
    antiSnipeSeconds: row.anti_snipe_seconds ?? 120,
    maxExtensions: row.max_extensions ?? 5,
    createdBy: row.created_by,
    approvedBy: row.approved_by,
    winnerId: row.winner_id,
    sealedOpenedAt: row.sealed_opened_at,
  };
}

function mapBid(row: DbBid): BidRecord {
  return {
    id: row.id,
    auctionId: row.auction_id,
    bidderId: row.bidder_id,
    amount: row.amount,
    status: row.status,
    isSealed: row.is_sealed,
    commitmentHash: row.commitment_hash,
    placedAt: row.placed_at.toISOString(),
    idempotencyKey: row.idempotency_key,
    withdrawnAt: row.withdrawn_at?.toISOString(),
    withdrawalReason: row.withdrawal_reason ?? undefined,
  };
}

export async function lockAuction(auctionId: string): Promise<AuctionLockSnapshot | null> {
  const row = await queryOne<DbAuctionLock>(
    `SELECT * FROM auctions WHERE id = $1 FOR UPDATE`,
    [auctionId],
  );
  return row ? mapAuction(row) : null;
}

export async function findAuction(auctionId: string): Promise<AuctionLockSnapshot | null> {
  const row = await queryOne<DbAuctionLock>(`SELECT * FROM auctions WHERE id = $1`, [auctionId]);
  return row ? mapAuction(row) : null;
}

export async function findBidder(userId: string): Promise<BidderSnapshot | null> {
  // NOTE: the column is full_name. It was renamed from display_name by
  // migration 003_schema_alignment; the old name here made every bid
  // placement fail with "column display_name does not exist".
  const row = await queryOne<{
    id: string;
    verification_status: string;
    email: string;
    full_name: string;
    is_active: boolean;
  }>(
    `SELECT id, verification_status, email, full_name, is_active
       FROM profiles WHERE id = $1`,
    [userId],
  );
  if (!row) return null;
  return {
    id: row.id,
    verificationStatus: row.verification_status,
    email: row.email,
    displayName: row.full_name,
    isActive: row.is_active,
  };
}

export async function isOrgOfficer(orgId: string, userId: string): Promise<boolean> {
  const row = await queryOne<{ ok: boolean }>(
    `SELECT EXISTS (
        SELECT 1 FROM organization_members
         WHERE organization_id = $1 AND user_id = $2
           AND role IN ('org_admin', 'organization_admin', 'auction_officer', 'compliance_officer')
     ) AS ok`,
    [orgId, userId],
  );
  return Boolean(row?.ok);
}

export async function hasVerifiedDeposit(auctionId: string, bidderId: string, requiredAmount: string): Promise<boolean> {
  const row = await queryOne<{ ok: boolean }>(
    `SELECT EXISTS (
        SELECT 1 FROM deposits
         WHERE auction_id = $1
           AND bidder_id = $2
           AND status = 'verified'
           AND amount >= $3::numeric
     ) AS ok`,
    [auctionId, bidderId, requiredAmount],
  );
  return Boolean(row?.ok);
}

export async function findBidByIdempotencyKey(key: string): Promise<BidRecord | null> {
  const row = await queryOne<DbBid>(`SELECT * FROM bids WHERE idempotency_key = $1`, [key]);
  return row ? mapBid(row) : null;
}

export async function insertBid(input: {
  auctionId: string;
  bidderId: string;
  amount: string;
  isSealed: boolean;
  commitmentHash: string | null;
  idempotencyKey: string;
  ipHash: string | null;
}): Promise<BidRecord> {
  const result = await query<DbBid>(
    `INSERT INTO bids (
        auction_id, bidder_id, amount, is_sealed, commitment_hash, idempotency_key, ip_hash, status
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'active')
     RETURNING *`,
    [
      input.auctionId,
      input.bidderId,
      input.amount,
      input.isSealed,
      input.commitmentHash,
      input.idempotencyKey,
      input.ipHash,
    ],
  );
  return mapBid(result.rows[0]);
}

export async function listFormFields(auctionId: string): Promise<Array<{
  id: string; fieldType: string; required: boolean; options: string[]; minValue: string | null; maxValue: string | null;
}>> {
  const rows = await queryAll<{
    id: string; field_type: string; required: boolean; options: string[]; min_value: string | null; max_value: string | null;
  }>(
    "SELECT id, field_type, required, options, min_value, max_value FROM auction_form_fields WHERE auction_id = $1 ORDER BY position",
    [auctionId],
  );
  return rows.map((row) => ({ id: row.id, fieldType: row.field_type, required: row.required, options: row.options ?? [], minValue: row.min_value, maxValue: row.max_value }));
}

export async function saveFormResponses(bidId: string, responses: Record<string, string>): Promise<void> {
  await query(
    `INSERT INTO bid_form_responses (bid_id, responses) VALUES ($1, $2)
     ON CONFLICT (bid_id) DO UPDATE SET responses = EXCLUDED.responses`,
    [bidId, JSON.stringify(responses)],
  );
}

export async function applyAuctionBidState(input: {
  auctionId: string;
  highestBid: string;
  bidCountDelta: number;
  closesAt: Date;
  extensionCount: number;
  replaceHighest?: boolean;
}): Promise<AuctionLockSnapshot> {
  const highestExpr = input.replaceHighest
    ? `$2::numeric`
    : `GREATEST(current_highest_bid, $2::numeric)`;
  const result = await query<DbAuctionLock>(
    `UPDATE auctions
        SET current_highest_bid = ${highestExpr},
            bid_count = bid_count + $3,
            closes_at = $4,
            extension_count = $5
      WHERE id = $1
      RETURNING *`,
    [input.auctionId, input.highestBid, input.bidCountDelta, input.closesAt, input.extensionCount],
  );
  return mapAuction(result.rows[0]);
}

export async function listBids(auctionId: string): Promise<BidRecord[]> {
  const rows = await queryAll<DbBid>(
    `SELECT * FROM bids WHERE auction_id = $1 ORDER BY placed_at ASC, amount DESC`,
    [auctionId],
  );
  return rows.map(mapBid);
}

/** The most recent `limit` bids, newest first, for the bid-history feed.
 * Scoring and reporting use the unbounded listBids above. */
export async function listLatestBids(auctionId: string, limit: number): Promise<BidRecord[]> {
  const rows = await queryAll<DbBid>(
    `SELECT * FROM bids WHERE auction_id = $1 ORDER BY placed_at DESC, amount DESC LIMIT $2`,
    [auctionId, limit],
  );
  return rows.map(mapBid);
}

export async function listRecentBids(auctionId: string, since: Date): Promise<BidRecord[]> {
  const rows = await queryAll<DbBid>(
    `SELECT * FROM bids WHERE auction_id = $1 AND placed_at >= $2 AND status = 'active'`,
    [auctionId, since],
  );
  return rows.map(mapBid);
}

export async function findBid(bidId: string): Promise<BidRecord | null> {
  const row = await queryOne<DbBid>(`SELECT * FROM bids WHERE id = $1`, [bidId]);
  return row ? mapBid(row) : null;
}

export async function supersedeOtherActiveBids(
  auctionId: string,
  bidderId: string,
  exceptBidId: string,
): Promise<void> {
  await query(
    `UPDATE bids
        SET status = 'superseded'
      WHERE auction_id = $1
        AND bidder_id = $2
        AND id <> $3
        AND status = 'active'
        AND is_sealed = FALSE`,
    [auctionId, bidderId, exceptBidId],
  );
}

export async function withdrawBid(bidId: string, reason: string): Promise<BidRecord> {
  const result = await query<DbBid>(
    `UPDATE bids
        SET status = 'withdrawn', withdrawn_at = NOW(), withdrawal_reason = $2
      WHERE id = $1
      RETURNING *`,
    [bidId, reason],
  );
  return mapBid(result.rows[0]);
}

export async function markSealedOpened(
  auctionId: string,
  openedBy: string,
  outcome: { winnerId: string | null; winningAmount: string | null; cancellationReason?: string },
): Promise<AuctionLockSnapshot> {
  const result = await query<DbAuctionLock>(
    `UPDATE auctions
        SET sealed_opened_at = NOW(), sealed_opened_by = $2,
            closed_at = COALESCE(closed_at, NOW()),
            winner_id = $3, winning_amount = $4,
            status = CASE WHEN $5::text IS NULL THEN status ELSE 'cancelled' END,
            cancellation_reason = COALESCE($5, cancellation_reason), updated_at = NOW()
      WHERE id = $1 RETURNING *`,
    [auctionId, openedBy, outcome.winnerId, outcome.winningAmount, outcome.cancellationReason ?? null],
  );
  return mapAuction(result.rows[0]);
}

export async function findLeadingBid(auctionId: string): Promise<BidRecord | null> {
  const row = await queryOne<DbBid>(
    `SELECT * FROM bids
      WHERE auction_id = $1 AND status = 'active'
      ORDER BY amount DESC, placed_at ASC
      LIMIT 1`,
    [auctionId],
  );
  return row ? mapBid(row) : null;
}

export async function listOrgOfficerIds(orgId: string): Promise<string[]> {
  const rows = await queryAll<{ user_id: string }>(
    `SELECT user_id FROM organization_members
      WHERE organization_id = $1
        AND role IN ('org_admin', 'organization_admin', 'auction_officer', 'compliance_officer')`,
    [orgId],
  );
  return rows.map((row) => row.user_id);
}

export async function countActiveBids(auctionId: string): Promise<{ count: number; highest: string }> {
  const row = await queryOne<{ count: string; highest: string | null }>(
    `SELECT COUNT(*)::text AS count, COALESCE(MAX(amount), 0)::text AS highest
       FROM bids WHERE auction_id = $1 AND status = 'active'`,
    [auctionId],
  );
  return { count: Number(row?.count ?? 0), highest: row?.highest ?? "0.00" };
}

export async function countAuctionItems(auctionId: string): Promise<number> {
  const row = await queryOne<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM auction_items WHERE auction_id = $1`,
    [auctionId],
  );
  return Number(row?.count ?? 0);
}

export async function listBidFeatures(auctionId: string): Promise<{
  ipHash: string | null;
  bidderId: string;
  amount: string;
  placedAt: Date;
}[]> {
  return queryAll(
    `SELECT ip_hash AS "ipHash", bidder_id AS "bidderId", amount, placed_at AS "placedAt"
       FROM bids WHERE auction_id = $1 AND status = 'active'`,
    [auctionId],
  );
}
