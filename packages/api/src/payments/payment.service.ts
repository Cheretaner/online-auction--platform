import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { InitiateChapaDepositRequest, Role } from "@auction/shared";
import { compareMoney } from "../kernel/money.js";
import { env } from "../config/env.js";
import { withTransaction } from "../infrastructure/database/tx.js";
import { queryOne } from "../infrastructure/database/query.js";
import { AppError, HttpStatus } from "../shared/errors/index.js";
import * as audit from "../audit/audit.service.js";
import * as biddingRepo from "../bidding/bidding.repository.js";
import { IdentityRepository } from "../identity/identity.repository.js";
import * as notifications from "../notification/notification.service.js";
import { enqueueOutbox } from "../infrastructure/outbox/outbox.repository.js";
import * as deposits from "../deposit/deposit.repository.js";
import * as settlementRepo from "../settlement/settlement.repository.js";
import type { SettlementObligation } from "../settlement/settlement.types.js";
import { logger } from "../shared/utils/logger.js";
import { ChapaAdapter, type ChapaVerification } from "./chapa.adapter.js";
import * as paymentRepo from "./payment.repository.js";

interface Actor {
  userId: string;
  roles: Role[];
}

const identityRepo = new IdentityRepository();
const chapa = new ChapaAdapter();

export async function initiateChapaDeposit(
  actor: Actor,
  input: InitiateChapaDepositRequest,
): Promise<{ depositId: string; txRef: string; checkoutUrl: string | null; status: string }> {
  if (!env.CHAPA_SECRET_KEY || !env.CHAPA_WEBHOOK_SECRET) {
    throw new AppError("Chapa payments are not configured", HttpStatus.SERVICE_UNAVAILABLE);
  }

  const profile = await identityRepo.findProfileById(actor.userId);
  if (!profile) throw AppError.notFound("Profile not found");
  const fullName = profile.fullName.trim().split(/\s+/);
  const firstName = fullName.shift() ?? "Bidder";
  const lastName = fullName.join(" ") || firstName;

  const prepared = await withTransaction(async (client) => {
    await deposits.lockAuctionBidderRegistration(input.auctionId, actor.userId, client);
    const auction = await biddingRepo.findAuction(input.auctionId);
    if (!auction) throw AppError.notFound("Auction not found");
    if (!["scheduled", "live"].includes(auction.status)) {
      throw AppError.unprocessable(`Deposits cannot be registered for an auction in status '${auction.status}'`);
    }
    if (compareMoney(auction.depositAmount, "0.00") <= 0) {
      throw AppError.unprocessable("This auction does not require a bid security deposit");
    }

    let deposit = await deposits.findByAuctionAndBidder(input.auctionId, actor.userId);
    let created = false;
    if (deposit && deposit.instrumentType !== "chapa") {
      throw AppError.conflict("A manual deposit is already registered for this auction");
    }
    if (deposit?.status === "pending") {
      const latest = await paymentRepo.findLatestForDeposit(deposit.id, client);
      if (latest?.status === "reconciliation_required") {
        throw AppError.conflict("This payment requires manual reconciliation before retrying");
      }
    }
    if (deposit?.status === "verified") {
      return { deposit, transaction: null, checkoutUrl: null, created: false };
    }
    if (deposit?.status === "released") {
      throw AppError.conflict("This deposit has already been released");
    }

    if (!deposit) {
      const txRef = `dep-${randomUUID()}`;
      deposit = await deposits.createDeposit({
        auctionId: input.auctionId,
        bidderId: actor.userId,
        amount: auction.depositAmount,
        referenceNumber: txRef,
        issuingBank: "Chapa",
        instrumentType: "chapa",
      });
      created = true;
    } else if (deposit.status === "rejected") {
      const txRef = `dep-${randomUUID()}`;
      await deposits.resetChapaDepositForRetry(deposit.id, txRef);
      deposit = (await deposits.findById(deposit.id))!;
    }

    let transaction = await paymentRepo.findLatestForDeposit(deposit.id, client);
    if (transaction && transaction.status === "pending" && transaction.checkoutUrl) {
      return { deposit, transaction, checkoutUrl: transaction.checkoutUrl, created };
    }
    if (!transaction || transaction.status !== "initializing") {
      transaction = await paymentRepo.create({
        depositId: deposit.id,
        txRef: `dep-${randomUUID()}`,
        amount: deposit.amount,
      }, client);
      await queryOne(
        `UPDATE deposits SET reference_number = $2, updated_at = NOW() WHERE id = $1 RETURNING id`,
        [deposit.id, transaction.txRef],
        client,
      );
    }

    if (created) {
      await audit.appendAuditEvent({
        auctionId: auction.id,
        actorId: actor.userId,
        actorRole: audit.actorRoleOf(actor.roles),
        entityType: "deposit",
        entityId: deposit.id,
        action: "deposit.payment_initiated",
        payload: { amount: deposit.amount, provider: "chapa", txRef: transaction.txRef },
      });
      const officers = await biddingRepo.listOrgOfficerIds(auction.orgId);
      await notifications.notifyMany(
        officers.map((userId) => ({
          userId,
          channel: "in_app" as const,
          type: "deposit.registered",
          title: "Digital deposit awaiting payment",
          message: `A Chapa bid-security payment was initiated for "${auction.title}".`,
          relatedEntityType: "deposit",
          relatedEntityId: deposit!.id,
        })),
      );
    }
    return { deposit: deposit!, transaction: transaction!, checkoutUrl: null, created };
  }, { userId: actor.userId });

  if (prepared.checkoutUrl || !prepared.transaction) {
    return {
      depositId: prepared.deposit.id,
      txRef: prepared.deposit.referenceNumber,
      checkoutUrl: prepared.checkoutUrl,
      status: prepared.deposit.status,
    };
  }

  try {
    const checkoutUrl = await chapa.initialize({
      txRef: prepared.transaction.txRef,
      amount: prepared.transaction.amount,
      email: profile.email,
      firstName,
      lastName,
      returnUrl: `${env.WEB_BASE_URL.replace(/\/$/, "")}/app/deposits`,
    });
    await paymentRepo.saveCheckoutUrl(prepared.transaction.id, checkoutUrl);
    return {
      depositId: prepared.deposit.id,
      txRef: prepared.transaction.txRef,
      checkoutUrl,
      status: "pending",
    };
  } catch {
    // Keep the attempt retryable with the same tx_ref if the network failed
    // after Chapa accepted the initialization request.
    throw new AppError("Could not start Chapa checkout. Retry shortly.", HttpStatus.SERVICE_UNAVAILABLE);
  }
}

export async function initiateChapaSettlement(
  actor: Actor,
  auctionId: string,
): Promise<{ settlementId: string; txRef: string; checkoutUrl: string | null; status: string }> {
  if (!env.CHAPA_SECRET_KEY || !env.CHAPA_WEBHOOK_SECRET) {
    throw new AppError("Chapa payments are not configured", HttpStatus.SERVICE_UNAVAILABLE);
  }

  const profile = await identityRepo.findProfileById(actor.userId);
  if (!profile) throw AppError.notFound("Profile not found");
  const fullName = profile.fullName.trim().split(/\s+/);
  const firstName = fullName.shift() ?? "Bidder";
  const lastName = fullName.join(" ") || firstName;

  const prepared = await withTransaction(async (client) => {
    const obligation = await settlementRepo.lockByAuctionAndWinner(auctionId, actor.userId, client);
    if (!obligation) throw AppError.notFound("Settlement obligation not found");
    if (obligation.status === "paid") {
      return { obligation, transaction: null, checkoutUrl: null };
    }
    if (obligation.status === "cancelled" || obligation.status === "reconciliation_required") {
      throw AppError.conflict("This settlement cannot currently accept payment");
    }

    let transaction = await paymentRepo.findLatestForSettlement(obligation.id, client);
    if (transaction?.status === "reconciliation_required") {
      throw AppError.conflict("This settlement requires manual reconciliation before retrying");
    }
    if (transaction?.status === "pending" && transaction.checkoutUrl) {
      return { obligation, transaction, checkoutUrl: transaction.checkoutUrl };
    }
    if (!transaction || transaction.status !== "initializing") {
      transaction = await paymentRepo.create({
        settlementId: obligation.id,
        txRef: `settle-${randomUUID()}`,
        amount: obligation.amount,
      }, client);
      await settlementRepo.markPaymentPending(obligation.id, client);
      await audit.appendAuditEvent({
        auctionId,
        actorId: actor.userId,
        actorRole: audit.actorRoleOf(actor.roles),
        entityType: "settlement",
        entityId: obligation.id,
        action: "settlement.payment_initiated",
        payload: { amount: obligation.amount, currency: obligation.currency, txRef: transaction.txRef },
      });
    }
    return { obligation, transaction, checkoutUrl: null };
  }, { userId: actor.userId });

  if (prepared.checkoutUrl || !prepared.transaction) {
    return {
      settlementId: prepared.obligation.id,
      txRef: prepared.transaction?.txRef ?? "",
      checkoutUrl: prepared.checkoutUrl,
      status: prepared.obligation.status,
    };
  }

  try {
    const checkoutUrl = await chapa.initialize({
      txRef: prepared.transaction.txRef,
      amount: prepared.transaction.amount,
      email: profile.email,
      firstName,
      lastName,
      returnUrl: `${env.WEB_BASE_URL.replace(/\/$/, "")}/auctions/${auctionId}`,
    });
    await paymentRepo.saveCheckoutUrl(prepared.transaction.id, checkoutUrl);
    return {
      settlementId: prepared.obligation.id,
      txRef: prepared.transaction.txRef,
      checkoutUrl,
      status: "payment_pending",
    };
  } catch {
    throw new AppError("Could not start Chapa checkout. Retry shortly.", HttpStatus.SERVICE_UNAVAILABLE);
  }
}

export async function listMySettlements(winnerId: string): Promise<SettlementObligation[]> {
  return settlementRepo.findByWinner(winnerId);
}

async function applyRefundStatus(
  refund: paymentRepo.ProviderRefund,
  providerStatus: string,
): Promise<void> {
  const status = providerStatus.toLowerCase();
  if (status === "refunded") {
    await withTransaction(async (client) => {
      const current = await queryOne<{ status: string }>(
        `SELECT status FROM provider_refunds WHERE id = $1 FOR UPDATE`,
        [refund.id],
        client,
      );
      if (!current || current.status === "refunded") return;
      const released = await queryOne<{ id: string }>(
        `UPDATE deposits SET status = 'released', released_at = NOW(), updated_at = NOW()
          WHERE id = $1 AND status = 'verified' AND provider_verified = TRUE
          RETURNING id`,
        [refund.depositId],
        client,
      );
      if (!released) {
        await queryOne(
          `UPDATE provider_refunds SET status = 'reconciliation_required', last_checked_at = NOW(), updated_at = NOW()
            WHERE id = $1 RETURNING id`,
          [refund.id],
          client,
        );
        return;
      }
      await queryOne(
        `UPDATE provider_refunds SET status = 'refunded', last_checked_at = NOW(), updated_at = NOW()
          WHERE id = $1`,
        [refund.id],
        client,
      );
      await audit.appendAuditEvent({
        auctionId: refund.auctionId,
        actorId: null,
        actorRole: audit.systemActorRole(),
        entityType: "deposit",
        entityId: refund.depositId,
        action: "deposit.refunded",
        payload: { amount: refund.amount, provider: "chapa", refundReference: refund.providerReference },
      });
      await notifications.enqueueNotification({
        userId: refund.bidderId,
        channel: "in_app",
        type: "deposit.released",
        title: "Bid-security refund completed",
        message: "Your Chapa bid-security deposit has been refunded.",
        relatedEntityType: "deposit",
        relatedEntityId: refund.depositId,
      });
    }, { userId: refund.bidderId });
    return;
  }

  const mapped = status === "initiated" || status === "processing" || status === "reversed"
    ? status
    : status === "failed" || status === "cancelled"
      ? "failed"
      : "reconciliation_required";
  await paymentRepo.updateRefundStatus(refund.id, mapped);
  if (mapped === "reversed" || mapped === "failed" || mapped === "reconciliation_required") {
    await audit.appendAuditEvent({
      auctionId: refund.auctionId,
      actorId: null,
      actorRole: audit.systemActorRole(),
      entityType: "deposit",
      entityId: refund.depositId,
      action: "deposit.refund_reconciliation_required",
      payload: { amount: refund.amount, provider: "chapa", status: mapped },
    });
    const officers = await biddingRepo.listOrgOfficerIds(
      (await biddingRepo.findAuction(refund.auctionId))?.orgId ?? "",
    );
    await notifications.notifyMany(officers.map((userId) => ({
      userId,
      channel: "in_app" as const,
      type: "deposit.refund_reconciliation_required",
      title: "Bid-security refund needs review",
      message: `Chapa reported refund status '${mapped}' for a deposit.`,
      relatedEntityType: "deposit",
      relatedEntityId: refund.depositId,
    })));
  }
}

export async function refundNonWinnerChapaDeposits(
  auctionId: string,
  winnerId: string | null,
): Promise<number> {
  const refundable = await paymentRepo.listRefundableDeposits(auctionId, winnerId);
  for (const item of refundable) {
    const refund = await paymentRepo.createOrGetRefund({
      transactionId: item.transactionId,
      depositId: item.depositId,
      merchantReference: `refund-${item.transactionId}`,
      amount: item.amount,
      reason: winnerId ? "Non-winning auction deposit" : "Auction cancelled or reserve not met",
    });
    if (["refunded", "initiated", "processing", "reversed", "failed", "reconciliation_required"].includes(refund.status)) continue;
    const reference = refund.providerReference ?? await chapa.refund(
      refund.txRef,
      refund.merchantReference,
      refund.reason,
    );
    await paymentRepo.markRefundInitiated(refund.id, reference);
    const verified = await chapa.verifyRefund(reference);
    await applyRefundStatus({ ...refund, providerReference: reference }, verified.status);
  }
  return refundable.length;
}

export async function reconcileChapaRefunds(): Promise<number> {
  const pending = await paymentRepo.findRefundsToReconcile();
  for (const refund of pending) {
    if (!refund.providerReference) continue;
    try {
      const verified = await chapa.verifyRefund(refund.providerReference);
      await applyRefundStatus(refund, verified.status);
    } catch (error) {
      logger.warn({ err: error, refundId: refund.id }, "Chapa refund status check failed");
    }
  }
  return pending.length;
}

export async function processChapaWebhook(
  txRef: string,
  eventHash: string,
): Promise<"processed" | "duplicate" | "pending"> {
  const owner = await paymentRepo.findPaymentOwnerByTxRef(txRef);
  if (!owner) throw AppError.notFound("Payment reference not found");
  const verified = await chapa.verify(txRef);
  const result = await withTransaction(async (client) => {
    const transaction = await queryOne<{
      id: string;
      deposit_id: string | null;
      settlement_id: string | null;
      amount: string;
      status: string;
    }>(
      `SELECT id, deposit_id, settlement_id, amount, status
         FROM provider_transactions WHERE tx_ref = $1 FOR UPDATE`,
      [txRef],
      client,
    );
    if (!transaction) throw AppError.notFound("Payment reference not found");
    if (transaction.status === "succeeded" || transaction.status === "reconciliation_required") return "duplicate" as const;
    const deposit = transaction.deposit_id
      ? await queryOne<{ bidder_id: string; auction_id: string; status: string }>(
          `SELECT bidder_id, auction_id, status FROM deposits WHERE id = $1 FOR UPDATE`,
          [transaction.deposit_id],
          client,
        )
      : null;
    const settlement = transaction.settlement_id
      ? await queryOne<{ winner_id: string; auction_id: string; status: string }>(
          `SELECT winner_id, auction_id, status FROM settlement_obligations WHERE id = $1 FOR UPDATE`,
          [transaction.settlement_id],
          client,
        )
      : null;
    if (!deposit && !settlement) throw AppError.notFound("Payment obligation not found");
    const auctionId = deposit?.auction_id ?? settlement!.auction_id;
    const subjectId = transaction.deposit_id ?? transaction.settlement_id!;
    const bidderId = deposit?.bidder_id ?? settlement!.winner_id;
    const subjectStatus = deposit?.status ?? settlement!.status;

    const amountsMatch = compareMoney(verified.amount, transaction.amount) === 0;
    const transactionMatches = verified.txRef === txRef && verified.currency === "ETB";
    if (verified.status === "pending") return "pending" as const;
    if (transaction.status === "failed" && verified.status !== "success") return "duplicate" as const;

    if (!amountsMatch || !transactionMatches) {
      await queryOne(
        `UPDATE provider_transactions
            SET status = 'reconciliation_required', processed_event_hash = $2,
                processed_at = NOW(), updated_at = NOW()
          WHERE id = $1 RETURNING id`,
        [transaction.id, eventHash],
        client,
      );
      await audit.appendAuditEvent({
        auctionId,
        actorId: null,
        actorRole: audit.systemActorRole(),
        entityType: deposit ? "deposit" : "settlement",
        entityId: subjectId,
        action: deposit ? "deposit.payment_reconciliation_required" : "settlement.payment_reconciliation_required",
        payload: { txRef, amountMatches: amountsMatch, currencyMatches: verified.currency === "ETB" },
      });
      return "processed" as const;
    }

    const canApplySuccess = deposit
      ? ["pending", "rejected"].includes(subjectStatus)
      : ["due", "payment_pending"].includes(subjectStatus);
    if (verified.status === "success" && !canApplySuccess) {
      await queryOne(
        `UPDATE provider_transactions
            SET status = 'reconciliation_required', processed_event_hash = $2,
                processed_at = NOW(), updated_at = NOW()
          WHERE id = $1 RETURNING id`,
        [transaction.id, eventHash],
        client,
      );
      if (settlement) {
        await queryOne(
          `UPDATE settlement_obligations SET status = 'reconciliation_required', updated_at = NOW()
            WHERE id = $1 RETURNING id`,
          [subjectId],
          client,
        );
      }
      await audit.appendAuditEvent({
        auctionId,
        actorId: null,
        actorRole: audit.systemActorRole(),
        entityType: deposit ? "deposit" : "settlement",
        entityId: subjectId,
        action: deposit ? "deposit.payment_reconciliation_required" : "settlement.payment_reconciliation_required",
        payload: { txRef, reason: "Payment completed after the local obligation changed state" },
      });
      return "processed" as const;
    }

    if (verified.status !== "success") {
      await queryOne(
        `UPDATE provider_transactions
            SET status = 'failed', processed_event_hash = $2, processed_at = NOW(), updated_at = NOW()
          WHERE id = $1 RETURNING id`,
        [transaction.id, eventHash],
        client,
      );
      if (deposit) {
        await deposits.updateStatus(subjectId, "rejected", {
          rejectionReason: "Chapa reported that the payment did not complete",
        });
      } else {
        await queryOne(
          `UPDATE settlement_obligations SET status = 'due', updated_at = NOW()
            WHERE id = $1 RETURNING id`,
          [subjectId],
          client,
        );
      }
      await audit.appendAuditEvent({
        auctionId,
        actorId: null,
        actorRole: audit.systemActorRole(),
        entityType: deposit ? "deposit" : "settlement",
        entityId: subjectId,
        action: deposit ? "deposit.payment_failed" : "settlement.payment_failed",
        payload: { txRef },
      });
      return "processed" as const;
    }

    await queryOne(
      `UPDATE provider_transactions
          SET status = 'succeeded', provider_reference = $2, processed_event_hash = $3,
              processed_at = NOW(), updated_at = NOW()
        WHERE id = $1 RETURNING id`,
      [transaction.id, verified.providerReference, eventHash],
      client,
    );
    if (deposit && ["pending", "rejected"].includes(subjectStatus)) {
      await queryOne(
        `UPDATE deposits
            SET status = 'verified', verified_by = NULL, verified_at = NOW(),
                rejection_reason = NULL, provider_verified = TRUE, updated_at = NOW()
          WHERE id = $1`,
        [subjectId],
        client,
      );
    } else if (settlement && ["due", "payment_pending"].includes(subjectStatus)) {
      await queryOne(
        `UPDATE settlement_obligations SET status = 'paid', paid_at = NOW(), updated_at = NOW()
          WHERE id = $1`,
        [subjectId],
        client,
      );
      await enqueueOutbox({
        aggregateType: "settlement",
        aggregateId: subjectId,
        eventType: "settlement.paid",
        payload: { settlementId: subjectId, auctionId, winnerId: bidderId },
      });
    }
    await audit.appendAuditEvent({
      auctionId,
      actorId: null,
      actorRole: audit.systemActorRole(),
      entityType: deposit ? "deposit" : "settlement",
      entityId: subjectId,
      action: deposit ? "deposit.payment_verified" : "settlement.payment_verified",
      payload: { amount: transaction.amount, provider: "chapa", txRef },
    });
    await notifications.enqueueNotification({
      userId: bidderId,
      channel: "in_app",
      type: deposit ? "deposit.reviewed" : "settlement.paid",
      title: deposit ? "Digital deposit verified" : "Final payment received",
      message: deposit
        ? "Your Chapa payment was verified. You are eligible to bid on this auction."
        : "Your final payment for the awarded auction was received.",
      relatedEntityType: deposit ? "deposit" : "settlement",
      relatedEntityId: subjectId,
    });
    return "processed" as const;
  }, { userId: owner.bidderId });

  return result;
}

export function webhookEventHash(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export function chapaPaymentOptions(): { chapa: boolean } {
  return { chapa: Boolean(env.CHAPA_SECRET_KEY && env.CHAPA_WEBHOOK_SECRET) };
}

export function verifyChapaWebhookSignature(
  payload: unknown,
  signature: string | undefined,
  secret = env.CHAPA_WEBHOOK_SECRET,
): boolean {
  if (!signature || !secret) return false;

  const normalized = signature.trim().replace(/^sha256\s*=/i, "").trim();
  if (!/^[a-f0-9]{64}$/i.test(normalized)) return false;

  const signedExpected = createHmac("sha256", secret)
    .update(JSON.stringify(payload))
    .digest("hex");
  const left = Buffer.from(normalized, "hex");
  const right = Buffer.from(signedExpected, "hex");
  return left.length === right.length && timingSafeEqual(left, right);
}
