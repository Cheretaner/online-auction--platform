import { DOMAIN_EVENTS } from "../kernel/events.js";
import { isUniqueViolation } from "../kernel/pg.js";
import { primaryActorRole } from "../kernel/roles.js";
import { enqueueOutbox } from "../infrastructure/outbox/outbox.repository.js";
import { withTransaction } from "../infrastructure/database/tx.js";
import { AppError, HttpStatus } from "../shared/errors/index.js";
import * as audit from "../audit/audit.service.js";
import * as auctionService from "../auction/auction.service.js";
import * as biddingRepo from "../bidding/bidding.repository.js";
import * as notifications from "../notification/notification.service.js";
import * as repo from "./dispute.repository.js";
import { assertDisputeTransition } from "./dispute.transitions.js";
import type { DisputeRecord } from "./dispute.repository.js";

export async function openDispute(input: {
  auctionId: string;
  raisedBy: string;
  roles: import("@auction/shared").Role[];
  reason: string;
  evidence: Record<string, unknown>;
}): Promise<DisputeRecord> {
  return withTransaction(async () => {
    const auction = await biddingRepo.findAuction(input.auctionId);
    if (!auction) throw new AppError("Auction not found", HttpStatus.NOT_FOUND);

    let dispute: DisputeRecord;
    try {
      dispute = await repo.insertDispute({
        auctionId: input.auctionId,
        raisedBy: input.raisedBy,
        reason: input.reason,
        evidence: input.evidence,
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new AppError("An open dispute already exists for this auction", HttpStatus.CONFLICT);
      }
      throw error;
    }

    await audit.appendAuditEvent({
      auctionId: auction.id,
      actorId: input.raisedBy,
      actorRole: primaryActorRole(input.roles),
      entityType: "dispute",
      entityId: dispute.id,
      action: DOMAIN_EVENTS.DISPUTE_OPENED,
      payload: { reason: input.reason },
    });

    await auctionService.markUnderReviewIfNeeded({
      auctionId: auction.id,
      actorId: input.raisedBy,
      actorRole: primaryActorRole(input.roles),
      reason: `Dispute ${dispute.id} opened`,
    });

    await enqueueOutbox({
      aggregateType: "auction",
      aggregateId: auction.id,
      eventType: DOMAIN_EVENTS.DISPUTE_OPENED,
      payload: { auctionId: auction.id, disputeId: dispute.id },
    });

    const officers = await biddingRepo.listOrgOfficerIds(auction.orgId);
    await notifications.notifyMany(
      officers.map((userId) => ({
        userId,
        channel: "in_app" as const,
        type: "dispute.opened",
        title: "Dispute opened",
        message: `A dispute was opened on "${auction.title}".`,
        relatedEntityType: "dispute",
        relatedEntityId: dispute.id,
      })),
    );

    return dispute;
  }, { userId: input.raisedBy });
}

export async function listDisputes(input: {
  viewerId: string;
  roles: import("@auction/shared").Role[];
  auctionId?: string;
}): Promise<DisputeRecord[]> {
  const officer = input.roles.some((role) =>
    ["compliance_officer", "org_admin", "auction_officer", "super_admin"].includes(role),
  );
  if (officer) return repo.listDisputes({ auctionId: input.auctionId });
  return repo.listDisputes({ raisedBy: input.viewerId });
}

export async function getDispute(id: string): Promise<DisputeRecord> {
  const dispute = await repo.findDispute(id);
  if (!dispute) throw new AppError("Dispute not found", HttpStatus.NOT_FOUND);
  return dispute;
}

export async function assignDispute(input: {
  id: string;
  actorId: string;
  roles: import("@auction/shared").Role[];
  reviewerId: string;
}): Promise<DisputeRecord> {
  return withTransaction(async () => {
    const dispute = await repo.findDispute(input.id);
    if (!dispute) throw new AppError("Dispute not found", HttpStatus.NOT_FOUND);
    assertDisputeTransition(dispute.status, "under_review");

    // The person who raised a dispute must not end up reviewing it.
    if (dispute.raisedBy === input.reviewerId) {
      throw new AppError(
        "The bidder who raised a dispute cannot review it",
        HttpStatus.UNPROCESSABLE,
        "APPROVAL_SELF",
      );
    }

    const updated = await repo.assignReviewer(input.id, input.reviewerId);

    await audit.appendAuditEvent({
      auctionId: updated.auctionId,
      actorId: input.actorId,
      actorRole: primaryActorRole(input.roles),
      entityType: "dispute",
      entityId: updated.id,
      action: DOMAIN_EVENTS.DISPUTE_UPDATED,
      payload: { status: updated.status, assignedReviewer: input.reviewerId },
    });

    await notifications.enqueueNotification({
      userId: input.reviewerId,
      channel: "in_app",
      type: "dispute.assigned",
      title: "Dispute assigned",
      message: "You were assigned a dispute to review.",
      relatedEntityType: "dispute",
      relatedEntityId: updated.id,
    });

    return updated;
  }, { userId: input.actorId });
}

export async function resolveDispute(input: {
  id: string;
  actorId: string;
  roles: import("@auction/shared").Role[];
  status: "resolved" | "rejected";
  decision: string;
  decisionReason: string;
}): Promise<DisputeRecord> {
  return withTransaction(async () => {
    const dispute = await repo.findDispute(input.id);
    if (!dispute) throw new AppError("Dispute not found", HttpStatus.NOT_FOUND);
    assertDisputeTransition(dispute.status, input.status);

    if (dispute.raisedBy === input.actorId) {
      throw new AppError(
        "You cannot resolve a dispute you raised",
        HttpStatus.UNPROCESSABLE,
        "APPROVAL_SELF",
      );
    }
    const updated = await repo.resolveDispute({
      id: input.id,
      status: input.status,
      decision: input.decision,
      decisionReason: input.decisionReason,
    });

    await audit.appendAuditEvent({
      auctionId: updated.auctionId,
      actorId: input.actorId,
      actorRole: primaryActorRole(input.roles),
      entityType: "dispute",
      entityId: updated.id,
      action: DOMAIN_EVENTS.DISPUTE_UPDATED,
      payload: { status: updated.status, decision: input.decision },
    });

    await notifications.enqueueNotification({
      userId: updated.raisedBy,
      channel: "in_app",
      type: "dispute.resolved",
      title: `Dispute ${updated.status}`,
      message: input.decisionReason,
      relatedEntityType: "dispute",
      relatedEntityId: updated.id,
    });

    return updated;
  }, { userId: input.actorId });
}
