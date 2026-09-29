import { sealedBidCommitmentPreimage } from "@auction/shared";

export interface SealedCommitment {
  commitmentHash: string;
  nonce: string;
}

function toHex(bytes: ArrayBuffer | Uint8Array): string {
  return Array.from(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/** Normalizes an amount the way the API stores it: two decimal places. */
export function normalizeAmount(amount: string): string {
  const value = Number(amount);
  return Number.isFinite(value) ? value.toFixed(2) : amount;
}

/**
 * Builds the sealed-bid commitment described in @auction/shared
 * (sealedBidCommitmentPreimage). The nonce never leaves the browser except
 * as the receipt shown to the bidder.
 */
export async function createSealedCommitment(auctionId: string, amount: string): Promise<SealedCommitment> {
  const nonce = toHex(crypto.getRandomValues(new Uint8Array(16)));
  const preimage = sealedBidCommitmentPreimage(auctionId, amount, nonce);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(preimage));
  return { commitmentHash: toHex(digest), nonce };
}
