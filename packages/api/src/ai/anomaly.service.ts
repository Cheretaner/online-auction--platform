import { DOMAIN_EVENTS } from "../kernel/events.js";
import { enqueueOutbox } from "../infrastructure/outbox/outbox.repository.js";
import { aiProviderAdapter } from "../infrastructure/ai/provider.adapter.js";
import * as auctionService from "../auction/auction.service.js";
import * as biddingRepo from "../bidding/bidding.repository.js";
import * as notifications from "../notification/notification.service.js";
import * as repo from "./ai.repository.js";
import { evaluateAuctionAnomalies } from "./anomaly.rules.js";
import type { AnomalyFlag } from "./ai.repository.js";
import type { AnomalyAdvisory } from "./ai.types.js";
import type { Role } from "@auction/shared";
import * as audit from "../audit/audit.service.js";
import { withTransaction } from "../infrastructure/database/tx.js";
import { primaryActorRole } from "../kernel/roles.js";
import { AppError, HttpStatus } from "../shared/errors/index.js";
import { logger } from "../shared/utils/logger.js";

/**
 * Asks the configured model for a narrative read of the behavioural features.
 *
 * Deliberately advisory-only: the deterministic rules remain the gate that
 * creates a flag, so a model outage can never change an enforcement outcome.
 * It is never called from the per-bid path - only from an explicit scan.
 */
async function requestAdvisory(auctionId: string): Promise<AnomalyAdvisory | null> {
  try {
    const auction = await biddingRepo.findAuction(auctionId);
    if (!auction) return null;
    const bids = await biddingRepo.listBids(auctionId);
    const features = await biddingRepo.listBidFeatures(auctionId);

    const result = await aiProviderAdapter.detectAnomaly({
      auction,
      bidCount: bids.length,
      // Cap the sample so the prompt stays small and cost stays predictable.
      features: features.slice(-25),
    });

    return {
      flagged: result.flagged,
      ...(result.reason ? { reason: result.reason } : {}),
      provider: result.provider ?? "unknown",
    };
  } catch (error) {
    logger.warn({ err: error, auctionId }, "AI anomaly advisory unavailable");
    return null;
  }
}

export async function evaluateAuction(
  auctionId: string,
  options: { useAi?: boolean } = {},
): Promise<AnomalyFlag | null> {
  const auction = await biddingRepo.findAuction(auctionId);
  if (!auction) return null;
  const bids = await biddingRepo.listBids(auctionId);
  const features = await biddingRepo.listBidFeatures(auctionId);
  const evaluation = evaluateAuctionAnomalies({ auction, bids, features });
  if (!evaluation) return null;

  let advisory: AnomalyAdvisory | null = null;
  if (options.useAi) {
    advisory = await requestAdvisory(auctionId);
  }

  const featureValues: Record<string, unknown> = advisory
    ? { ...evaluation.features, aiAdvisory: advisory }
    : evaluation.features;

  const explanation = advisory?.reason
    ? `${evaluation.explanation}\n\nAI review (${advisory.provider}): ${advisory.reason}`
    : evaluation.explanation;

  const flag = await repo.insertFlag({
    auctionId,
    subjectAccounts: evaluation.subjects,
    score: evaluation.score,
    severity: evaluation.severity,
    triggeredRules: evaluation.rules,
    featureValues,
    explanation,
  });

  await enqueueOutbox({
    aggregateType: "auction",
    aggregateId: auctionId,
    eventType: DOMAIN_EVENTS.ANOMALY_FLAGGED,
    payload: { auctionId, flagId: flag.id, severity: flag.severity, score: flag.score },
  });

  if (flag.severity === "high") {
    // FR15: an unresolved high-severity flag marks the outcome provisional
    // and keeps the auction under review until a compliance decision.
    await auctionService.markUnderReviewIfNeeded({
      auctionId,
      actorId: null,
      actorRole: "system",
      reason: `High-severity anomaly flag ${flag.id}`,
    });
  }

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

/**
 * Explicit, user-triggered risk scan. Unlike the per-bid path this one always
 * consults the model, so compliance gets a narrative even when no deterministic
 * rule fired - which is exactly what the "Run AI scan" action is for.
 */
export async function assessAuction(auctionId: string): Promise<{
  flag: AnomalyFlag | null;
  advisory: AnomalyAdvisory | null;
}> {
  const advisory = await requestAdvisory(auctionId);
  const flag = await evaluateAuction(auctionId, { useAi: false });
  return { flag, advisory };
}

export async function listAnomalies(input: {
  auctionId?: string;
  orgId?: string;
}): Promise<AnomalyFlag[]> {
  return repo.listFlags(input);
}

export async function getAnomaly(id: string): Promise<AnomalyFlag> {
  const flag = await repo.findFlag(id);
  if (!flag) throw new AppError("Anomaly not found", HttpStatus.NOT_FOUND);
  return flag;
}

/** Records a compliance decision on a flag. The decision and the audit event
 * are written in one transaction, as for every other state change. */
export async function reviewAnomaly(input: {
  id: string;
  reviewerId: string;
  roles: Role[];
  status: "reviewed" | "dismissed" | "escalated";
  decisionNote: string;
}): Promise<AnomalyFlag> {
  return withTransaction(async () => {
    const updated = await repo.reviewFlag(input);
    if (!updated) throw new AppError("Anomaly not found", HttpStatus.NOT_FOUND);

    await audit.appendAuditEvent({
      auctionId: updated.auctionId,
      actorId: input.reviewerId,
      actorRole: primaryActorRole(input.roles),
      entityType: "anomaly_flag",
      entityId: updated.id,
      action: "anomaly.reviewed",
      payload: { status: input.status, severity: updated.severity, score: updated.score },
    });
    return updated;
  }, { userId: input.reviewerId });
}
