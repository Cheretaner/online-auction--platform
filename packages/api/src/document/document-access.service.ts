import { randomUUID } from "node:crypto";
import type { Role } from "@auction/shared";
import { AppError, HttpStatus } from "../shared/errors/index.js";
import { query, queryOne } from "../infrastructure/database/query.js";
import { withTransaction } from "../infrastructure/database/tx.js";
import { IdentityRepository } from "../identity/identity.repository.js";
import { ChapaAdapter } from "../payments/chapa.adapter.js";
import { env } from "../config/env.js";
import { compareMoney } from "../kernel/money.js";
import * as audit from "../audit/audit.service.js";

const identityRepo = new IdentityRepository();
const chapa = new ChapaAdapter();

export type DocumentAccessStatus =
  | "not_required"
  | "not_purchased"
  | "pending"
  | "succeeded"
  | "failed"
  | "reconciliation_required";

export interface DocumentAccessState {
  required: boolean;
  paid: boolean;
  status: DocumentAccessStatus;
  amount: string;
  paidAt: string | null;
  checkoutUrl: string | null;
}

interface AccessPayment {
  id: string;
  payment_reference: string;
  checkout_url: string | null;
  status: Exclude<DocumentAccessStatus, "not_required" | "not_purchased">;
  amount: string;
  paid_at: Date | null;
  created_at: Date;
}

async function findAuction(auctionId: string) {
  return queryOne<{
    id: string;
    title: string;
    status: string;
    document_access_fee: string;
  }>(
    "SELECT id, title, status, document_access_fee FROM auctions WHERE id = $1",
    [auctionId],
  );
}

async function latestPayment(auctionId: string, bidderId: string): Promise<AccessPayment | null> {
  return queryOne<AccessPayment>(
    `SELECT id, payment_reference, checkout_url, status, amount, paid_at, created_at
       FROM auction_document_access
      WHERE auction_id = $1 AND bidder_id = $2
      ORDER BY created_at DESC, id DESC
      LIMIT 1`,
    [auctionId, bidderId],
  );
}

export async function hasPaidDocumentAccess(auctionId: string, bidderId: string): Promise<boolean> {
  const row = await queryOne<{ ok: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM auction_document_access
        WHERE auction_id = $1 AND bidder_id = $2 AND status = 'succeeded'
     ) AS ok`,
    [auctionId, bidderId],
  );
  return Boolean(row?.ok);
}

export async function auctionRequiresDocumentAccess(auctionId: string): Promise<boolean> {
  const row = await queryOne<{ required: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM documents
        WHERE auction_id = $1 AND requires_payment = TRUE
     ) AS required`,
    [auctionId],
  );
  return Boolean(row?.required);
}

export async function getDocumentAccessStatus(
  auctionId: string,
  bidderId: string,
  verifyPendingPayment = false,
): Promise<DocumentAccessState> {
  const auction = await findAuction(auctionId);
  if (!auction) throw AppError.notFound("Auction not found");

  const required = await auctionRequiresDocumentAccess(auctionId);
  if (!required) {
    return {
      required: false,
      paid: false,
      status: "not_required",
      amount: auction.document_access_fee,
      paidAt: null,
      checkoutUrl: null,
    };
  }

  let payment = await latestPayment(auctionId, bidderId);
  if (verifyPendingPayment && payment?.status === "pending") {
    await processDocumentAccessPayment(payment.payment_reference);
    payment = await latestPayment(auctionId, bidderId);
  }

  if (!payment) {
    return {
      required: true,
      paid: false,
      status: "not_purchased",
      amount: auction.document_access_fee,
      paidAt: null,
      checkoutUrl: null,
    };
  }

  const successfulPayment = await queryOne<AccessPayment>(
    `SELECT id, payment_reference, checkout_url, status, amount, paid_at, created_at
       FROM auction_document_access
      WHERE auction_id = $1 AND bidder_id = $2 AND status = 'succeeded'
      ORDER BY paid_at DESC NULLS LAST, created_at DESC
      LIMIT 1`,
    [auctionId, bidderId],
  );
  return {
    required: true,
    paid: Boolean(successfulPayment),
    status: successfulPayment ? "succeeded" : payment.status,
    amount: successfulPayment?.amount ?? payment.amount,
    paidAt: successfulPayment
      ? successfulPayment.paid_at?.toISOString() ?? null
      : null,
    checkoutUrl: successfulPayment ? null : payment.checkout_url,
  };
}

export async function initiateDocumentAccess(
  actor: { userId: string; roles: Role[] },
  auctionId: string,
) {
  if (!env.CHAPA_SECRET_KEY || !env.CHAPA_WEBHOOK_SECRET) {
    throw new AppError("Chapa payments are not configured", HttpStatus.SERVICE_UNAVAILABLE);
  }
  const profile = await identityRepo.findProfileById(actor.userId);
  if (!profile) throw AppError.notFound("Profile not found");

  const auction = await findAuction(auctionId);
  if (!auction) throw AppError.notFound("Auction not found");
  if (!["scheduled", "live"].includes(auction.status)) {
    throw AppError.unprocessable("Tender documents are no longer available for purchase");
  }
  if (!(await auctionRequiresDocumentAccess(auctionId))) {
    throw AppError.unprocessable("This auction has no paid tender documents");
  }
  let lastAttempt = await latestPayment(auctionId, actor.userId);
  if (lastAttempt?.status === "pending") {
    await processDocumentAccessPayment(lastAttempt.payment_reference);
    lastAttempt = await latestPayment(auctionId, actor.userId);
  }
  if (lastAttempt?.status === "succeeded") {
    return {
      status: "succeeded" as const,
      checkoutUrl: null,
      txRef: lastAttempt.payment_reference,
    };
  }
  if (lastAttempt?.status === "reconciliation_required") {
    throw AppError.conflict("A previous document payment needs manual reconciliation before another attempt");
  }
  if (await hasPaidDocumentAccess(auctionId, actor.userId)) {
    return {
      status: "succeeded" as const,
      checkoutUrl: null,
      txRef: (await latestPayment(auctionId, actor.userId))?.payment_reference ?? "",
    };
  }

  const payment = await withTransaction(async (client) => {
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
      [`document-access:${auctionId}:${actor.userId}`],
    );

    const succeeded = await queryOne<{ payment_reference: string }>(
      `SELECT payment_reference FROM auction_document_access
        WHERE auction_id = $1 AND bidder_id = $2 AND status = 'succeeded'
        ORDER BY created_at DESC LIMIT 1`,
      [auctionId, actor.userId],
      client,
    );
    if (succeeded) {
      return { kind: "succeeded" as const, txRef: succeeded.payment_reference };
    }

    const pending = await queryOne<AccessPayment>(
      `SELECT id, payment_reference, checkout_url, status, amount, paid_at, created_at
         FROM auction_document_access
        WHERE auction_id = $1 AND bidder_id = $2 AND status = 'pending'
        ORDER BY created_at DESC, id DESC
        LIMIT 1`,
      [auctionId, actor.userId],
      client,
    );
    if (pending) {
      return pending.checkout_url
        ? { kind: "pending" as const, txRef: pending.payment_reference, checkoutUrl: pending.checkout_url }
        : { kind: "initializing" as const, txRef: pending.payment_reference };
    }

    const txRef = `doc-${randomUUID()}`;
    const inserted = await queryOne<{ id: string }>(
      `INSERT INTO auction_document_access (auction_id, bidder_id, payment_reference, amount, status)
       VALUES ($1, $2, $3, $4, 'pending')
       RETURNING id`,
      [auctionId, actor.userId, txRef, auction.document_access_fee],
      client,
    );
    if (!inserted) throw new Error("Could not create document-access payment attempt");
    return { kind: "create" as const, id: inserted.id, txRef };
  }, { userId: actor.userId });

  if (payment.kind === "succeeded") {
    return { status: "succeeded" as const, checkoutUrl: null, txRef: payment.txRef };
  }
  if (payment.kind === "pending") {
    return { status: "pending" as const, checkoutUrl: payment.checkoutUrl, txRef: payment.txRef };
  }
  if (payment.kind === "initializing") {
    return { status: "pending" as const, checkoutUrl: null, txRef: payment.txRef };
  }

  const fullName = profile.fullName.trim().split(/\s+/);
  let checkoutUrl: string;
  try {
    checkoutUrl = await chapa.initialize({
      txRef: payment.txRef,
      amount: auction.document_access_fee,
      email: profile.email,
      firstName: fullName.shift() ?? "Bidder",
      lastName: fullName.join(" ") || "Bidder",
      returnUrl: `${env.WEB_BASE_URL.replace(/\/$/, "")}/auctions/${auctionId}`,
      customization: {
        title: "Tender documents",
        description: "One-time access to this auction's tender documents",
      },
    });
  } catch (error) {
    await query(
      `UPDATE auction_document_access
          SET status = 'failed', updated_at = NOW()
        WHERE id = $1 AND status = 'pending'`,
      [payment.id],
    );
    throw error;
  }

  await query(
    `UPDATE auction_document_access
        SET checkout_url = $2, updated_at = NOW()
      WHERE id = $1 AND status = 'pending'`,
    [payment.id, checkoutUrl],
  );
  return { status: "pending" as const, checkoutUrl, txRef: payment.txRef };
}

export async function processDocumentAccessPayment(txRef: string): Promise<"unknown" | "pending" | "processed"> {
  const access = await queryOne<{
    id: string;
    auction_id: string;
    bidder_id: string;
    amount: string;
    status: string;
  }>(
    `SELECT id, auction_id, bidder_id, amount, status
       FROM auction_document_access
      WHERE payment_reference = $1`,
    [txRef],
  );
  if (!access) return "unknown";
  if (access.status === "succeeded") return "processed";

  const verified = await chapa.verify(txRef);
  return withTransaction(async (client) => {
    const current = await queryOne<{
      id: string;
      auction_id: string;
      bidder_id: string;
      amount: string;
      status: string;
    }>(
      `SELECT id, auction_id, bidder_id, amount, status
         FROM auction_document_access
        WHERE payment_reference = $1
        FOR UPDATE`,
      [txRef],
      client,
    );
    if (!current) return "unknown";
    if (current.status === "succeeded") return "processed";
    if (current.status === "reconciliation_required") return "processed";
    if (current.status === "failed" && verified.status !== "success") return "processed";

    if (
      verified.txRef !== txRef ||
      verified.currency !== "ETB" ||
      verified.amount.length > 32 ||
      !/^\d+(?:\.\d{1,2})?$/.test(verified.amount) ||
      compareMoney(verified.amount, current.amount) !== 0
    ) {
      await query(
        `UPDATE auction_document_access
            SET status = 'reconciliation_required',
                provider_reference = $2,
                updated_at = NOW()
          WHERE id = $1`,
        [current.id, verified.providerReference?.slice(0, 128) ?? null],
        client,
      );
      await audit.appendAuditEvent({
        auctionId: current.auction_id,
        actorId: current.bidder_id,
        actorRole: "bidder",
        entityType: "document_access_payment",
        entityId: current.id,
        action: "document_access.payment_reconciliation_required",
        payload: {
          expectedAmount: current.amount,
          receivedAmount: verified.amount.slice(0, 64),
          receivedCurrency: verified.currency.slice(0, 12),
          providerReference: verified.providerReference?.slice(0, 128) ?? null,
        },
      });
      return "processed";
    }

    if (verified.status === "pending") return "pending";
    const status = verified.status === "success" ? "succeeded" : "failed";
    await query(
      `UPDATE auction_document_access
          SET status = $2,
              provider_reference = $3,
              paid_at = CASE WHEN $2 = 'succeeded' THEN NOW() ELSE paid_at END,
              updated_at = NOW()
        WHERE id = $1`,
      [current.id, status, verified.providerReference?.slice(0, 128) ?? null],
      client,
    );
    await audit.appendAuditEvent({
      auctionId: current.auction_id,
      actorId: current.bidder_id,
      actorRole: "bidder",
      entityType: "document_access_payment",
      entityId: current.id,
      action: status === "succeeded"
        ? "document_access.payment_succeeded"
        : "document_access.payment_failed",
      payload: {
        amount: current.amount,
        currency: verified.currency.slice(0, 12),
        providerReference: verified.providerReference?.slice(0, 128) ?? null,
      },
    });
    return "processed";
  }, { userId: access.bidder_id });
}
