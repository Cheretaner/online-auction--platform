import type { ComplianceCheckStatus } from "@auction/shared";
import { DOMAIN_EVENTS } from "../kernel/events.js";
import { primaryActorRole } from "../kernel/roles.js";
import { enqueueOutbox } from "../infrastructure/outbox/outbox.repository.js";
import { withTransaction } from "../infrastructure/database/tx.js";
import { AppError, HttpStatus } from "../shared/errors/index.js";
import * as audit from "../audit/audit.service.js";
import * as biddingRepo from "../bidding/bidding.repository.js";
import * as anomalyRepo from "../ai/ai.repository.js";
import * as notifications from "../notification/notification.service.js";
import * as repo from "./compliance.repository.js";
import type { ComplianceCheckRecord } from "./compliance.repository.js";

export interface ComplianceFinding {
  code: string;
  severity: "info" | "warning" | "blocker";
  message: string;
}

export async function runComplianceCheck(input: {
  auctionId: string;
  actorId: string;
  roles: import("@auction/shared").Role[];
  organizationId?: string;
  notes?: string;
}): Promise<ComplianceCheckRecord> {
  return withTransaction(async () => {
    const auction = await biddingRepo.findAuction(input.auctionId);
    if (!auction) throw new AppError("Auction not found", HttpStatus.NOT_FOUND);

    const findings: ComplianceFinding[] = [];

    if (!auction.approvedBy) {
      findings.push({
        code: "MISSING_APPROVAL",
        severity: "blocker",
        message: "Two-person approval is missing",
      });
    }

    const unverified = await repo.countUnverifiedBidders(auction.id);
    if (unverified > 0) {
      findings.push({
        code: "UNVERIFIED_BIDDERS",
        severity: "blocker",
        message: `${unverified} active bidder(s) are not KYC verified`,
      });
    }

    if (Number(auction.depositAmount) > 0) {
      const missing = await repo.countMissingDeposits(auction.id, auction.depositAmount);
      if (missing > 0) {
        findings.push({
          code: "MISSING_DEPOSITS",
          severity: "blocker",
          message: `${missing} active bidder(s) lack a verified deposit`,
        });
      }
    }

    const openDisputes = await repo.countOpenDisputes(auction.id);
    if (openDisputes > 0) {
      findings.push({
        code: "OPEN_DISPUTES",
        severity: "warning",
        message: `${openDisputes} dispute(s) remain unresolved`,
      });
    }

    const highAnomalies = await anomalyRepo.countOpenHigh(auction.id);
    if (highAnomalies > 0) {
      findings.push({
        code: "HIGH_ANOMALIES",
        severity: "blocker",
        message: `${highAnomalies} high-severity anomaly flag(s) are still open`,
      });
    }

    const chain = await audit.verifyAuditChain(auction.id);
    if (!chain.intact) {
      findings.push({
        code: "CHAIN_BROKEN",
        severity: "blocker",
        message: chain.error ?? "Audit chain is not intact",
      });
    }

    if (
      auction.reservePrice &&
      Number(auction.currentHighestBid) < Number(auction.reservePrice) &&
      (auction.status === "closed" || auction.status === "under_review")
    ) {
      findings.push({
        code: "RESERVE_NOT_MET",
        severity: "warning",
        message: "Reserve price has not been met",
      });
    }

    const status: ComplianceCheckStatus = findings.some((item) => item.severity === "blocker")
      ? "failed"
      : "passed";

    const check = await repo.insertCheck({
      auctionId: auction.id,
      checkedBy: input.actorId,
      status,
      findings,
      notes: input.notes,
    });

    await audit.appendAuditEvent({
      auctionId: auction.id,
      actorId: input.actorId,
      actorRole: primaryActorRole(input.roles),
      entityType: "compliance_check",
      entityId: check.id,
      action: DOMAIN_EVENTS.COMPLIANCE_CHECKED,
      payload: { status, findings },
    });

    await enqueueOutbox({
      aggregateType: "auction",
      aggregateId: auction.id,
      eventType: DOMAIN_EVENTS.COMPLIANCE_CHECKED,
      payload: { auctionId: auction.id, checkId: check.id, status },
    });

    const officers = await biddingRepo.listOrgOfficerIds(auction.orgId);
    await notifications.notifyMany(
      officers.map((userId) => ({
        userId,
        channel: "in_app" as const,
        type: "compliance.checked",
        title: `Compliance ${status}`,
        message: `Compliance check for "${auction.title}" ${status}.`,
        relatedEntityType: "compliance_check",
        relatedEntityId: check.id,
      })),
    );

    return check;
  }, { userId: input.actorId, organizationId: input.organizationId });
}

export async function listChecks(auctionId: string): Promise<ComplianceCheckRecord[]> {
  return repo.listByAuction(auctionId);
}
