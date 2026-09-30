import { z } from "zod";
import { Money } from "./money.js";

export const PlaceBidRequest = z.object({
  amount: Money,
  commitmentHash: z
    .string()
    .regex(/^[a-fA-F0-9]{64}$/, "commitment hash must be sha256 hex")
    .optional(),
});
export type PlaceBidRequest = z.infer<typeof PlaceBidRequest>;

export const PlaceBidResponse = z.object({
  bidId: z.string().uuid(),
  amount: Money,
  placedAt: z.string().datetime(),
  auction: z.object({
    currentHighestBid: Money,
    bidCount: z.number().int(),
    closesAt: z.string().datetime(),
    extended: z.boolean(),
  }),
  audit: z.object({
    eventId: z.string().uuid(),
    sequenceNo: z.number().int(),
    hash: z.string().length(64),
  }),
});
export type PlaceBidResponse = z.infer<typeof PlaceBidResponse>;

export const WithdrawBidRequest = z.object({
  reason: z.string().min(8).max(2000),
});
export type WithdrawBidRequest = z.infer<typeof WithdrawBidRequest>;

/**
 * Sealed-bid commitment format.
 *
 * commitmentHash = lowercase hex SHA-256 of the UTF-8 string
 *   `cheretanet-sealed-bid:v1|<auctionId>|<amount>|<nonce>`
 * where <amount> is the same two-decimal string sent as `amount` and <nonce>
 * is 32 random hex characters chosen by the bidder's browser.
 *
 * The API records the hash in the bid row and in the audit chain before the
 * amount is revealed. The bidder keeps the nonce as a receipt: after sealed
 * bids are opened, anyone holding (auctionId, amount, nonce) can recompute
 * the hash and check that the recorded amount is the one they committed to.
 */
export function sealedBidCommitmentPreimage(auctionId: string, amount: string, nonce: string): string {
  return `cheretanet-sealed-bid:v1|${auctionId}|${amount}|${nonce}`;
}
