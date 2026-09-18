import { DOMAIN_EVENTS } from "../kernel/events.js";
import { enqueueOutbox } from "../infrastructure/outbox/outbox.repository.js";
import * as biddingRepo from "../bidding/bidding.repository.js";
import * as notifications from "../notification/notification.service.js";
import * as repo from "./ai.repository.js";
import { evaluateAuctionAnomalies } from "./anomaly.rules.js";
import type { AnomalyFlag } from "./ai.repository.js";

export async function evaluateAuction(auctionId: string): Promise<AnomalyFlag | null> {
  const auction = await biddingRepo.findAuction(auctionId);
  if (!auction) return null;
  const bids = await biddingRepo.listBids(auctionId);
  const features = await biddingRepo.listBidFeatures(auctionId);
  const evaluation = evaluateAuctionAnomalies({ auction, bids, features });
  if (!evaluation) return null;

  const flag = await repo.insertFlag({
    auctionId,
    subjectAccounts: evaluation.subjects,
    score: evaluation.score,
    severity: evaluation.severity,
    triggeredRules: evaluation.rules,
    featureValues: evaluation.features,
    explanation: evaluation.explanation,
  });

  await enqueueOutbox({
    aggregateType: "auction",
    aggregateId: auctionId,
    eventType: DOMAIN_EVENTS.ANOMALY_FLAGGED,
    payload: { auctionId, flagId: flag.id, severity: flag.severity, score: flag.score },
  });

  const officers = await biddingRepo.listOrgOfficerIds(auction.orgId);
  await notifications.notifyMany(
    officers.map((userId) => ({
      userId,
      channel: "in_app" as const,
      type: "anomaly.flagged",
      title: `Anomaly ${flag.severity}`,
      message: flag.explanation ?? "Anomaly detected",
      relatedEntityType: "anomaly_flag",
      relatedEntityId: flag.id,
    })),
  );

  return flag;
}

export async function listAnomalies(auctionId?: string): Promise<AnomalyFlag[]> {
  return repo.listFlags(auctionId);
}

export async function reviewAnomaly(input: {
  id: string;
  reviewerId: string;
  status: "reviewed" | "dismissed" | "escalated";
  decisionNote: string;
}): Promise<AnomalyFlag> {
  const updated = await repo.reviewFlag(input);
  if (!updated) {
    const { AppError, HttpStatus } = await import("../shared/errors/index.js");
    throw new AppError("Anomaly not found", HttpStatus.NOT_FOUND);
  }
  return updated;
}
