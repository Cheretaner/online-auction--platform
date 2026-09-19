import type { CreateDepositRequest, ReviewDepositRequest } from "@auction/shared";
import { AppError, HttpStatus } from "../shared/errors/index.js";
import { withTransaction } from "../infrastructure/database/tx.js";
import * as repo from "./deposit.repository.js";
import type { Deposit } from "./deposit.types.js";

export async function createDeposit(
  bidderId: string,
  input: CreateDepositRequest,
): Promise<Deposit> {
  return withTransaction(async () => {
    const existing = await repo.findByAuctionAndBidder(input.auctionId, bidderId);
    if (existing) {
      throw AppError.conflict("A deposit already exists for this auction");
    }

    return repo.createDeposit({
      auctionId: input.auctionId,
      bidderId,
      amount: input.amount,
      referenceNumber: input.referenceNumber,
      issuingBank: input.issuingBank,
      instrumentType: input.instrumentType,
      documentId: input.documentId,
    });
  }, { userId: bidderId });
}

export async function reviewDeposit(
  depositId: string,
  reviewerId: string,
  input: ReviewDepositRequest,
): Promise<Deposit> {
  return withTransaction(async () => {
    const deposit = await repo.findById(depositId);
    if (!deposit) throw AppError.notFound("Deposit not found");
    if (deposit.status !== "pending") {
      throw AppError.unprocessable(`Cannot review a deposit with status '${deposit.status}'`);
    }

    if (input.decision === "verified") {
      return repo.updateStatus(depositId, "verified", {
        verifiedBy: reviewerId,
        verifiedAt: new Date(),
      });
    } else {
      return repo.updateStatus(depositId, "rejected", {
        rejectionReason: input.rejectionReason,
      });
    }
  }, { userId: reviewerId });
}

export async function releaseDeposit(depositId: string, userId: string): Promise<Deposit> {
  return withTransaction(async () => {
    const deposit = await repo.findById(depositId);
    if (!deposit) throw AppError.notFound("Deposit not found");
    if (deposit.status !== "verified") {
      throw AppError.unprocessable(`Cannot release a deposit with status '${deposit.status}'`);
    }
    return repo.updateStatus(depositId, "released", { releasedAt: new Date() });
  }, { userId });
}

export async function getDeposit(id: string): Promise<Deposit> {
  const deposit = await repo.findById(id);
  if (!deposit) throw AppError.notFound("Deposit not found");
  return deposit;
}

export async function listByAuction(auctionId: string): Promise<Deposit[]> {
  return repo.findByAuction(auctionId);
}
