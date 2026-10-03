import { DOMAIN_EVENTS } from "../kernel/events.js";
import { isUniqueViolation } from "../kernel/pg.js";
import { primaryActorRole } from "../kernel/roles.js";
import { enqueueOutbox } from "../infrastructure/outbox/outbox.repository.js";
import { withTransaction } from "../infrastructure/database/tx.js";
import { assertAuctionAccess } from "../shared/authz/auction-access.js";
import { AppError, HttpStatus } from "../shared/errors/index.js";
import * as audit from "../audit/audit.service.js";
import * as auctionService from "../auction/auction.service.js";
import * as biddingRepo from "../bidding/bidding.repository.js";
import * as documentService from "../document/document.service.js";
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

    // Only people who took part (a bid or a deposit) may contest an auction;
    // otherwise any account could file disputes against any auction.
    if (!(await repo.isParticipant(auction.id, input.raisedBy))) {
      throw new AppError(
        "Only participants in this auction can raise a dispute about it",
        HttpStatus.FORBIDDEN,
        "FORBIDDEN",
      );
    }

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

    // A dispute holds the outcome of a closed auction until it is decided.
    // It must not stop a live one: under_review has no way back to live, so
    // a single complaint during bidding would end the auction for everyone.
    // Officers are notified below and can cancel if the complaint warrants it.
    if (auction.status === "closed") {
      await auctionService.markUnderReviewIfNeeded({
        auctionId: auction.id,
        actorId: input.raisedBy,
        actorRole: primaryActorRole(input.roles),
        reason: `Dispute ${dispute.id} opened`,
      });
    }

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
  organizationId?: string;
  auctionId?: string;
}): Promise<DisputeRecord[]> {
  if (input.roles.includes("super_admin")) return repo.listDisputes({ auctionId: input.auctionId });

  const officer = input.roles.some((role) =>
    ["compliance_officer", "org_admin", "auction_officer"].includes(role),
  );
  // Officers see disputes on their own organization's auctions only.
  if (officer && input.organizationId) {
    if (input.auctionId) {
      await assertAuctionAccess(input.auctionId, {
        userId: input.viewerId,
        roles: input.roles,
        organizationId: input.organizationId,
      });
      return repo.listDisputes({ auctionId: input.auctionId });
    }
    return repo.listDisputes({ orgId: input.organizationId });
  }
  return repo.listDisputes({ raisedBy: input.viewerId });
}

export async function getDispute(id: string): Promise<DisputeRecord> {
  const dispute = await repo.findDispute(id);
  if (!dispute) throw new AppError("Dispute not found", HttpStatus.NOT_FOUND);
  return dispute;
}

export async function createEvidenceBundle(input: {
  id: string;
  actorId: string;
  roles: import("@auction/shared").Role[];
}): Promise<Record<string, unknown>> {
  const dispute = await getDispute(input.id);
  const auction = await biddingRepo.findAuction(dispute.auctionId);
  if (!auction) throw new AppError("Auction not found", HttpStatus.NOT_FOUND);

  await audit.appendAuditEvent({
    auctionId: dispute.auctionId,
    actorId: input.actorId,
    actorRole: primaryActorRole(input.roles),
    entityType: "dispute",
    entityId: dispute.id,
    action: "dispute.evidence_bundle_downloaded",
    payload: { format: "json", version: 1 },
  });

  const [events, chainVerification, documents] = await Promise.all([
    audit.listAuditChain(dispute.auctionId),
    audit.verifyAuditChain(dispute.auctionId),
    documentService.listByAuction(dispute.auctionId),
  ]);

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    dispute,
    auction: { id: auction.id, title: auction.title, status: auction.status, auctionType: auction.auctionType },
    audit: { verification: chainVerification, events },
    documentManifest: {
      hashAlgorithm: "SHA-256",
      files: documents.map((document) => ({
        id: document.id,
        fileName: document.fileName,
        documentType: document.documentType,
        mimeType: document.mimeType,
        fileSizeBytes: document.fileSizeBytes,
        checksumSha256: document.checksumSha256,
        isPrivate: document.isPrivate,
        uploadedAt: document.createdAt,
      })),
    },
  };
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
