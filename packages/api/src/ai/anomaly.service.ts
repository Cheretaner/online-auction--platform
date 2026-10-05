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

  return enrichFlags([flag]).then((items) => items[0]);
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
  return enrichFlags(await repo.listFlags(input));
}

export async function getAnomaly(id: string): Promise<AnomalyFlag> {
  const flag = await repo.findFlag(id);
  if (!flag) throw new AppError("Anomaly not found", HttpStatus.NOT_FOUND);
  return (await enrichFlags([flag]))[0];
}

async function enrichFlags(flags: AnomalyFlag[]): Promise<AnomalyFlag[]> {
  const history = await repo.listRelatedHistory(flags.map((flag) => flag.id));
  return flags.map((flag) => ({ ...flag, relatedHistory: history.get(flag.id) ?? [] }));
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
    return (await enrichFlags([updated]))[0];
  }, { userId: input.reviewerId });
}

/**
 * Get historical context for an anomaly flag
 * Returns similar past flags and their outcomes
 */
export async function getAnomalyHistoricalContext(
  flagId: string,
  actor: { userId: string; roles: Role[]; organizationId?: string },
): Promise<{
  currentFlag: AnomalyFlag;
  similarFlagsByBidders: AnomalyFlag[];
  similarFlagsByRules: AnomalyFlag[];
  bidderProfiles: Array<{
    bidderId: string;
    totalFlags: number;
    highSeverityFlags: number;
    recentFlags: number;
    mostCommonRules: string[];
    dismissalRate: number;
    lastFlaggedAt: Date | null;
  }>;
  ruleOutcomes: Array<{
    rule: string;
    totalFlags: number;
    reviewedCount: number;
    dismissedCount: number;
    escalatedCount: number;
    avgScore: number;
    avgResolutionDays: number | null;
  }>;
}> {
  const currentFlag = await repo.findFlag(flagId);
  if (!currentFlag) {
    throw new AppError("Anomaly flag not found", HttpStatus.NOT_FOUND);
  }

  // Authorization: only officers can view historical context
  const isOfficer = actor.roles.some((r) =>
    ["org_admin", "auction_officer", "compliance_officer", "super_admin"].includes(r),
  );

  if (!isOfficer) {
    throw new AppError("Forbidden", HttpStatus.FORBIDDEN);
  }

  // Get historical flags for same bidders
  const similarFlagsByBidders = await repo.getHistoricalFlagsForBidders(
    currentFlag.subjectAccounts,
    20,
  );

  // Get historical flags with same rule patterns
  const similarFlagsByRules = await repo.getHistoricalFlagsByRules(
    currentFlag.triggeredRules,
    20,
  );

  // Get risk profiles for all subject bidders
  const bidderProfiles = await Promise.all(
    currentFlag.subjectAccounts.map((bidderId) =>
      repo.getBidderRiskProfile(bidderId),
    ),
  );

  // Get outcome statistics for each triggered rule
  const ruleOutcomes = await Promise.all(
    currentFlag.triggeredRules.map((rule) =>
      repo.getFlagOutcomeStatsByRule(rule),
    ),
  );

  logger.info({
    event: "anomaly:historical_context_viewed",
    flagId,
    userId: actor.userId,
    similarBidderFlags: similarFlagsByBidders.length,
    similarRuleFlags: similarFlagsByRules.length,
  });

  return {
    currentFlag,
    similarFlagsByBidders: similarFlagsByBidders.filter((f) => f.id !== flagId),
    similarFlagsByRules: similarFlagsByRules.filter((f) => f.id !== flagId),
    bidderProfiles,
    ruleOutcomes,
  };
}

/**
 * Get compliance patterns for an organization
 * Shows historical flag trends and resolution patterns
 */
export async function getOrgCompliancePatterns(
  orgId: string,
  actor: { userId: string; roles: Role[]; organizationId?: string },
): Promise<{
  totalFlags: number;
  flagsByRule: Record<string, number>;
  flagsBySeverity: Record<string, number>;
  flagsByStatus: Record<string, number>;
  avgResolutionDays: number;
  recentFlags: AnomalyFlag[];
}> {
  // Authorization
  const isOfficer = actor.roles.some((r) =>
    ["org_admin", "auction_officer", "compliance_officer", "super_admin"].includes(r),
  );

  if (!isOfficer) {
    throw new AppError("Forbidden", HttpStatus.FORBIDDEN);
  }

  if (!actor.roles.includes("super_admin") && actor.organizationId !== orgId) {
    throw new AppError("Forbidden", HttpStatus.FORBIDDEN);
  }

  const allFlags = await repo.getHistoricalFlagsForOrg(orgId, 200);

  // Aggregate statistics
  const flagsByRule: Record<string, number> = {};
  const flagsBySeverity: Record<string, number> = {};
  const flagsByStatus: Record<string, number> = {};
  let totalResolutionDays = 0;
  let resolvedCount = 0;

  for (const flag of allFlags) {
    // Count by rules
    for (const rule of flag.triggeredRules) {
      flagsByRule[rule] = (flagsByRule[rule] || 0) + 1;
    }

    // Count by severity
    flagsBySeverity[flag.severity] = (flagsBySeverity[flag.severity] || 0) + 1;

    // Count by status
    flagsByStatus[flag.status] = (flagsByStatus[flag.status] || 0) + 1;

    // Calculate resolution time
    if (flag.reviewedAt) {
      const created = new Date(flag.createdAt);
      const reviewed = new Date(flag.reviewedAt);
      const days = (reviewed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
      totalResolutionDays += days;
      resolvedCount++;
    }
  }

  const avgResolutionDays = resolvedCount > 0 ? totalResolutionDays / resolvedCount : 0;

  logger.info({
    event: "anomaly:org_patterns_viewed",
    orgId,
    userId: actor.userId,
    totalFlags: allFlags.length,
  });

  return {
    totalFlags: allFlags.length,
    flagsByRule,
    flagsBySeverity,
    flagsByStatus,
    avgResolutionDays,
    recentFlags: allFlags.slice(0, 10),
  };
}
