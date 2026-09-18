import type { ReportType } from "@auction/shared";
import { DOMAIN_EVENTS } from "../kernel/events.js";
import { primaryActorRole } from "../kernel/roles.js";
import { enqueueOutbox } from "../infrastructure/outbox/outbox.repository.js";
import { withTransaction } from "../infrastructure/database/tx.js";
import { AppError, HttpStatus } from "../shared/errors/index.js";
import * as audit from "../audit/audit.service.js";
import * as biddingRepo from "../bidding/bidding.repository.js";
import * as anomalyRepo from "../ai/ai.repository.js";
import * as complianceRepo from "../compliance/compliance.repository.js";
import * as disputeRepo from "../dispute/dispute.repository.js";
import * as notifications from "../notification/notification.service.js";
import * as repo from "./reporting.repository.js";
import type { ReportRecord } from "./reporting.repository.js";

export async function generateReport(input: {
  auctionId: string;
  type: ReportType;
  actorId: string;
  roles: import("@auction/shared").Role[];
  organizationId?: string;
}): Promise<ReportRecord> {
  return withTransaction(async () => {
    const auction = await biddingRepo.findAuction(input.auctionId);
    if (!auction) throw new AppError("Auction not found", HttpStatus.NOT_FOUND);

    const chain = await audit.verifyAuditChain(auction.id);
    const version = await repo.nextVersion(auction.id);
    const bids = await biddingRepo.listBids(auction.id);
    const anomalies = await anomalyRepo.listFlags(auction.id);
    const checks = await complianceRepo.listByAuction(auction.id);
    const disputes = await disputeRepo.listDisputes({ auctionId: auction.id });

    const reportData: Record<string, unknown> = {
      type: input.type,
      auction: {
        id: auction.id,
        title: auction.title,
        status: auction.status,
        type: auction.auctionType,
        highestBid: auction.sealedOpenedAt || auction.auctionType !== "sealed_bid" ? auction.currentHighestBid : null,
        bidCount: auction.bidCount,
        reservePrice: auction.reservePrice,
      },
      chain,
      bids: bids.map((bid) => ({
        id: bid.id,
        amount: auction.auctionType === "sealed_bid" && !auction.sealedOpenedAt ? null : bid.amount,
        status: bid.status,
        placedAt: bid.placedAt,
      })),
      anomalies: anomalies.map((flag) => ({
        id: flag.id,
        severity: flag.severity,
        status: flag.status,
        score: flag.score,
      })),
      compliance: checks.map((check) => ({ id: check.id, status: check.status, createdAt: check.createdAt })),
      disputes: disputes.map((item) => ({ id: item.id, status: item.status })),
    };

    const report = await repo.insertReport({
      auctionId: auction.id,
      reportType: input.type,
      reportVersion: version,
      chainHead: chain.headHash,
      chainVerified: chain.intact,
      chainVerificationError: chain.error,
      reportData,
    });

    await audit.appendAuditEvent({
      auctionId: auction.id,
      actorId: input.actorId,
      actorRole: primaryActorRole(input.roles),
      entityType: "auction_report",
      entityId: report.id,
      action: DOMAIN_EVENTS.REPORT_GENERATED,
      payload: { type: input.type, version, chainVerified: chain.intact },
    });

    await enqueueOutbox({
      aggregateType: "auction",
      aggregateId: auction.id,
      eventType: DOMAIN_EVENTS.REPORT_GENERATED,
      payload: { auctionId: auction.id, reportId: report.id, type: input.type },
    });

    return report;
  }, { userId: input.actorId, organizationId: input.organizationId });
}

export async function getReport(id: string): Promise<ReportRecord> {
  const report = await repo.findReport(id);
  if (!report) throw new AppError("Report not found", HttpStatus.NOT_FOUND, "REPORT_NOT_FOUND");
  return report;
}

export async function listReports(auctionId?: string): Promise<ReportRecord[]> {
  return repo.listReports(auctionId);
}

export async function publishReport(input: {
  id: string;
  actorId: string;
  roles: import("@auction/shared").Role[];
}): Promise<ReportRecord> {
  return withTransaction(async () => {
    const report = await repo.publishReport(input.id);
    if (!report) throw new AppError("Report not found", HttpStatus.NOT_FOUND, "REPORT_NOT_FOUND");
    if (!report.chainVerified) {
      throw new AppError("Cannot publish a report with a broken audit chain", HttpStatus.UNPROCESSABLE, "CHAIN_BROKEN");
    }

    await audit.appendAuditEvent({
      auctionId: report.auctionId,
      actorId: input.actorId,
      actorRole: primaryActorRole(input.roles),
      entityType: "auction_report",
      entityId: report.id,
      action: DOMAIN_EVENTS.REPORT_PUBLISHED,
      payload: { version: report.reportVersion },
    });

    const auction = await biddingRepo.findAuction(report.auctionId);
    if (auction) {
      const officers = await biddingRepo.listOrgOfficerIds(auction.orgId);
      await notifications.notifyMany(
        officers.map((userId) => ({
          userId,
          channel: "in_app" as const,
          type: "report.published",
          title: "Auction report published",
          message: `Report v${report.reportVersion} for "${auction.title}" is now published.`,
          relatedEntityType: "auction_report",
          relatedEntityId: report.id,
        })),
      );
    }

    return report;
  }, { userId: input.actorId });
}
