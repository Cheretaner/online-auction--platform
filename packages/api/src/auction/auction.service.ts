import type { CreateAuctionRequest } from "@auction/shared";
import { AppError, HttpStatus } from "../shared/errors/index.js";
import { DOMAIN_EVENTS } from "../kernel/events.js";
import { enqueueOutbox } from "../infrastructure/outbox/outbox.repository.js";
import * as audit from "../audit/audit.service.js";
import { assertTransition } from "./auction.stateMachine.js";
import * as repo from "./auction.repository.js";
import type { Auction } from "./auction.types.js";

export async function createAuction(
  input: CreateAuctionRequest & { createdBy: string },
): Promise<Auction> {
  if (new Date(input.closesAt) <= new Date(input.opensAt)) {
    throw new AppError("closesAt must be after opensAt", HttpStatus.BAD_REQUEST);
  }
  return repo.createAuction({
    organizationId: input.organizationId,
    title: input.title,
    description: input.description,
    auctionType: input.auctionType,
    startingPrice: input.startingPrice,
    reservePrice: input.reservePrice,
    minIncrement: input.minIncrement,
    depositAmount: input.depositAmount,
    opensAt: input.opensAt,
    closesAt: input.closesAt,
    antiSnipeSeconds: input.antiSnipeSeconds,
    maxExtensions: input.maxExtensions,
    createdBy: input.createdBy,
  });
}

export async function getAuction(id: string): Promise<Auction> {
  const auction = await repo.findAuctionById(id);
  if (!auction) throw new AppError("Auction not found", HttpStatus.NOT_FOUND);
  return auction;
}

export async function transitionAuction(id: string, toStatus: Auction["status"]): Promise<Auction> {
  const auction = await getAuction(id);
  assertTransition(auction.status, toStatus);
  return repo.updateAuctionStatus(id, toStatus);
}

/**
 * Per FR12/FR15/FR19: an unresolved high-severity anomaly flag or a raised
 * dispute against an auction's outcome pulls that auction into the
 * `under_review` state until a compliance officer records a decision. Both
 * the dispute and anomaly-detection subsystems call this instead of
 * duplicating the transition + audit + realtime-broadcast logic.
 *
 * No-op (returns null) if the auction is already under review or in a
 * state the SRS doesn't define this transition for (e.g. still `live`,
 * where bidding - not review - is the right response).
 */
export async function markUnderReviewIfNeeded(input: {
  auctionId: string;
  actorId: string | null;
  actorRole: string;
  reason: string;
}): Promise<Auction | null> {
  const auction = await repo.findAuctionById(input.auctionId);
  if (!auction) return null;
  if (auction.status !== "closed" && auction.status !== "awarded") return null;

  assertTransition(auction.status, "under_review");
  const updated = await repo.updateAuctionStatus(auction.id, "under_review");

  await audit.appendAuditEvent({
    auctionId: updated.id,
    actorId: input.actorId,
    actorRole: input.actorRole,
    entityType: "auction",
    entityId: updated.id,
    action: DOMAIN_EVENTS.AUCTION_UNDER_REVIEW,
    payload: { fromStatus: auction.status, reason: input.reason },
  });

  await enqueueOutbox({
    aggregateType: "auction",
    aggregateId: updated.id,
    eventType: DOMAIN_EVENTS.AUCTION_UNDER_REVIEW,
    payload: { auctionId: updated.id, reason: input.reason },
  });

  return updated;
}
