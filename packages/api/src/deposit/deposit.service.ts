import type { CreateDepositRequest, ReleaseDepositRequest, ReviewDepositRequest, Role } from "@auction/shared";
import { compareMoney } from "../kernel/money.js";
import { isUniqueViolation } from "../kernel/pg.js";
import { AppError } from "../shared/errors/index.js";
import { withTransaction } from "../infrastructure/database/tx.js";
import * as audit from "../audit/audit.service.js";
import * as biddingRepo from "../bidding/bidding.repository.js";
import * as notifications from "../notification/notification.service.js";
import * as repo from "./deposit.repository.js";
import type { Deposit } from "./deposit.types.js";
import { hashSensitive } from "../shared/security/sensitive-data.js";
import * as documentService from "../document/document.service.js";
import * as settlementRepo from "../settlement/settlement.repository.js";

interface Actor {
  userId: string;
  roles: Role[];
}

export async function createDeposit(actor: Actor, input: CreateDepositRequest): Promise<Deposit> {
  if (input.instrumentType === "cpo") {
    if (!input.documentId) throw AppError.badRequest("A scanned CPO proof is required");
    const proof = await documentService.getDocument(input.documentId);
    if (
      !proof ||
      proof.auctionId !== input.auctionId ||
      proof.uploadedBy !== actor.userId ||
      proof.documentType !== "cpo_proof" ||
      !proof.isPrivate
    ) {
      throw AppError.badRequest("Upload a private CPO proof for this auction before submitting the bid security");
    }
  }
  return withTransaction(
    async () => {
      const auction = await biddingRepo.findAuction(input.auctionId);
      if (!auction) throw AppError.notFound("Auction not found");

      // A deposit is only meaningful while the auction can still be bid on.
      if (!["scheduled", "live"].includes(auction.status)) {
        throw AppError.unprocessable(
          `Deposits cannot be registered for an auction in status '${auction.status}'`,
        );
      }

      // Under-funding the instrument would pass registration and then
      // silently fail the bid-time deposit check, which is confusing.
      if (compareMoney(input.amount, auction.depositAmount) < 0) {
        throw AppError.unprocessable(
          `Deposit must be at least ${auction.depositAmount} for this auction`,
          "DEPOSIT_REQUIRED",
        );
      }

      const existing = await repo.findByAuctionAndBidder(input.auctionId, actor.userId);
      if (existing) {
        throw AppError.conflict("A deposit already exists for this auction");
      }
      if (await repo.hasActiveReference(input.issuingBank, hashSensitive(input.referenceNumber)!)) {
        throw AppError.conflict("This bank reference is already associated with an active deposit");
      }

      let deposit: Deposit;
      try {
        deposit = await repo.createDeposit({
          auctionId: input.auctionId,
          bidderId: actor.userId,
          amount: input.amount,
          referenceNumber: input.referenceNumber,
          issuingBank: input.issuingBank,
          instrumentType: input.instrumentType,
          documentId: input.documentId,
        });
      } catch (error) {
        // uq_deposits_auction_bidder can still fire under concurrency.
        if (isUniqueViolation(error)) {
          throw AppError.conflict("A deposit already exists for this auction");
        }
        throw error;
      }

      await audit.appendAuditEvent({
        auctionId: auction.id,
        actorId: actor.userId,
        actorRole: audit.actorRoleOf(actor.roles),
        entityType: "deposit",
        entityId: deposit.id,
        action: "deposit.registered",
        payload: {
          amount: deposit.amount,
          instrumentType: deposit.instrumentType,
          issuingBank: deposit.issuingBank,
        },
      });

      const officers = await biddingRepo.listOrgOfficerIds(auction.orgId);
      await notifications.notifyMany(
        officers.map((userId) => ({
          userId,
          channel: "in_app" as const,
          type: "deposit.registered",
          title: "Deposit awaiting verification",
          message: `A deposit was registered for "${auction.title}".`,
          relatedEntityType: "deposit",
          relatedEntityId: deposit.id,
        })),
      );

      return deposit;
    },
    { userId: actor.userId },
  );
}

export async function reviewDeposit(
  depositId: string,
  actor: Actor,
  input: ReviewDepositRequest,
): Promise<Deposit> {
  return withTransaction(
    async () => {
      const deposit = await repo.findById(depositId);
      if (!deposit) throw AppError.notFound("Deposit not found");
      if (deposit.status !== "pending") {
        throw AppError.unprocessable(`Cannot review a deposit with status '${deposit.status}'`);
      }

      // Separation of duties: the person who lodged the instrument cannot
      // also be the one who verifies it.
      if (deposit.bidderId === actor.userId) {
        throw AppError.unprocessable("You cannot review your own deposit", "APPROVAL_SELF");
      }

      const updated =
        input.decision === "verified"
          ? await repo.updateStatus(depositId, "verified", {
              verifiedBy: actor.userId,
              verifiedAt: new Date(),
            })
          : await repo.updateStatus(depositId, "rejected", {
              rejectionReason: input.rejectionReason,
            });

      await audit.appendAuditEvent({
        auctionId: deposit.auctionId,
        actorId: actor.userId,
        actorRole: audit.actorRoleOf(actor.roles),
        entityType: "deposit",
        entityId: deposit.id,
        action: `deposit.${input.decision}`,
        payload: { amount: deposit.amount, reason: input.rejectionReason ?? null },
      });

      await notifications.enqueueNotification({
        userId: deposit.bidderId,
        channel: "in_app",
        type: "deposit.reviewed",
        title: input.decision === "verified" ? "Deposit verified" : "Deposit rejected",
        message:
          input.decision === "verified"
            ? "Your deposit was verified. You are now eligible to bid on this auction."
            : input.rejectionReason ?? "Your deposit was not accepted.",
        relatedEntityType: "deposit",
        relatedEntityId: deposit.id,
      });

      return updated;
    },
    { userId: actor.userId },
  );
}

export async function releaseDeposit(
  depositId: string,
  actor: Actor,
  input: ReleaseDepositRequest,
): Promise<Deposit> {
  return withTransaction(
    async () => {
      const deposit = await repo.findById(depositId);
      if (!deposit) throw AppError.notFound("Deposit not found");
      if (deposit.status !== "verified") {
        throw AppError.unprocessable(`Cannot release a deposit with status '${deposit.status}'`);
      }
      if (deposit.instrumentType === "chapa") {
        throw AppError.unprocessable(
          "A Chapa deposit cannot be marked released without a confirmed provider refund",
          "DEPOSIT_REFUND_REQUIRED",
        );
      }

      const releaseDocument = await documentService.getDocument(input.releaseDocumentId);
      if (
        !releaseDocument ||
        releaseDocument.uploadedBy !== actor.userId ||
        !releaseDocument.isPrivate ||
        releaseDocument.documentType !== "deposit_release_evidence"
      ) {
        throw AppError.badRequest("A private deposit-release evidence document uploaded by you is required");
      }

      const auction = await biddingRepo.findAuction(deposit.auctionId);

      // Releasing the winner's deposit before the award is settled would
      // remove the guarantee the process depends on.
      if (auction && auction.winnerId === deposit.bidderId && auction.status !== "awarded") {
        throw AppError.unprocessable(
          "The leading bidder's deposit cannot be released until the auction is awarded",
        );
      }
      if (auction?.winnerId === deposit.bidderId) {
        const settlement = await settlementRepo.findByAuctionAndWinner(auction.id, deposit.bidderId);
        if (settlement?.status !== "paid") {
          throw AppError.unprocessable("The winner's bid security cannot be released before final payment is reconciled");
        }
      }

      const updated = await repo.updateStatus(depositId, "released", {
        releasedAt: new Date(),
        releaseReferenceNumber: input.releaseReferenceNumber,
        releaseDocumentId: input.releaseDocumentId,
      });

      await audit.appendAuditEvent({
        auctionId: deposit.auctionId,
        actorId: actor.userId,
        actorRole: audit.actorRoleOf(actor.roles),
        entityType: "deposit",
        entityId: deposit.id,
        action: "deposit.released",
        payload: {
          amount: deposit.amount,
          releaseDocumentId: releaseDocument.id,
          releaseReferenceHash: hashSensitive(input.releaseReferenceNumber),
        },
      });

      await notifications.enqueueNotification({
        userId: deposit.bidderId,
        channel: "in_app",
        type: "deposit.released",
        title: "Deposit released",
        message: "Your deposit for this auction has been released.",
        relatedEntityType: "deposit",
        relatedEntityId: deposit.id,
      });

      return updated;
    },
    { userId: actor.userId },
  );
}

export async function getDeposit(id: string): Promise<Deposit> {
  const deposit = await repo.findById(id);
  if (!deposit) throw AppError.notFound("Deposit not found");
  return deposit;
}

export async function listByAuction(auctionId: string): Promise<Deposit[]> {
  return repo.findByAuction(auctionId);
}

export async function listByBidder(bidderId: string): Promise<Deposit[]> {
  return repo.findByBidder(bidderId);
}
