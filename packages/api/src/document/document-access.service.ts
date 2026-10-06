import { randomUUID } from "node:crypto";
import type { Role } from "@auction/shared";
import { AppError, HttpStatus } from "../shared/errors/index.js";
import { query, queryOne } from "../infrastructure/database/query.js";
import { IdentityRepository } from "../identity/identity.repository.js";
import { ChapaAdapter } from "../payments/chapa.adapter.js";
import { env } from "../config/env.js";
import { compareMoney } from "../kernel/money.js";

const identityRepo = new IdentityRepository();
const chapa = new ChapaAdapter();

export async function hasPaidDocumentAccess(auctionId: string, bidderId: string): Promise<boolean> {
  const row = await queryOne<{ ok: boolean }>(
    `SELECT EXISTS (SELECT 1 FROM auction_document_access
      WHERE auction_id = $1 AND bidder_id = $2 AND status = 'succeeded') AS ok`,
    [auctionId, bidderId],
  );
  return Boolean(row?.ok);
}

export async function initiateDocumentAccess(actor: { userId: string; roles: Role[] }, auctionId: string) {
  if (!env.CHAPA_SECRET_KEY || !env.CHAPA_WEBHOOK_SECRET) {
    throw new AppError("Chapa payments are not configured", HttpStatus.SERVICE_UNAVAILABLE);
  }
  const profile = await identityRepo.findProfileById(actor.userId);
  if (!profile) throw AppError.notFound("Profile not found");
  const auction = await queryOne<{ id: string; title: string; status: string; document_access_fee: string }>(
    "SELECT id, title, status, document_access_fee FROM auctions WHERE id = $1",
    [auctionId],
  );
  if (!auction) throw AppError.notFound("Auction not found");
  if (!["scheduled", "live"].includes(auction.status)) {
    throw AppError.unprocessable("Tender documents are no longer available for purchase");
  }

  const existing = await queryOne<{ payment_reference: string; status: string }>(
    "SELECT payment_reference, status FROM auction_document_access WHERE auction_id = $1 AND bidder_id = $2",
    [auctionId, actor.userId],
  );
  if (existing?.status === "succeeded") return { status: "succeeded", checkoutUrl: null, txRef: existing.payment_reference };
  const txRef = existing?.payment_reference ?? `doc-${randomUUID()}`;
  if (!existing) {
    await query(
      `INSERT INTO auction_document_access (auction_id, bidder_id, payment_reference, amount)
       VALUES ($1, $2, $3, $4)`,
      [auctionId, actor.userId, txRef, auction.document_access_fee],
    );
  }
  const fullName = profile.fullName.trim().split(/\s+/);
  const checkoutUrl = await chapa.initialize({
    txRef,
    amount: auction.document_access_fee,
    email: profile.email,
    firstName: fullName.shift() ?? "Bidder",
    lastName: fullName.join(" ") || "Bidder",
    returnUrl: `${env.WEB_BASE_URL.replace(/\/$/, "")}/auctions/${auctionId}`,
  });
  await query(
    "UPDATE auction_document_access SET status = 'pending', updated_at = NOW() WHERE payment_reference = $1",
    [txRef],
  );
  return { status: "pending", checkoutUrl, txRef };
}

export async function processDocumentAccessPayment(txRef: string, eventHash: string) {
  const access = await queryOne<{ id: string; auction_id: string; bidder_id: string; amount: string; status: string }>(
    "SELECT id, auction_id, bidder_id, amount, status FROM auction_document_access WHERE payment_reference = $1 FOR UPDATE",
    [txRef],
  );
  if (!access) return false;
  if (access.status === "succeeded") return true;
  const verified = await chapa.verify(txRef);
  if (verified.status === "pending") return false;
  if (verified.currency !== "ETB" || compareMoney(verified.amount, access.amount) !== 0) {
    await query(
      "UPDATE auction_document_access SET status = 'reconciliation_required', updated_at = NOW() WHERE id = $1",
      [access.id],
    );
    return true;
  }
  const status = verified.status === "success" ? "succeeded" : "failed";
  await query(
    `UPDATE auction_document_access SET status = $2, provider_reference = $3,
      paid_at = CASE WHEN $2 = 'succeeded' THEN NOW() ELSE paid_at END, updated_at = NOW()
     WHERE id = $1`,
    [access.id, status, verified.providerReference ?? eventHash],
  );
  return true;
}
