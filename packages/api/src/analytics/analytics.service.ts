import * as repo from "./analytics.repository.js";
import * as auctionRepo from "../auction/auction.repository.js";
import * as auctionItemRepo from "../auction/auction-item.repository.js";
import { AppError, HttpStatus } from "../shared/errors/index.js";
import { logger } from "../shared/utils/logger.js";
import type { Role } from "@auction/shared";

export interface ReservePriceRecommendationResult {
  recommendedReserve: string;
  confidenceScore: number;
  basedOnAuctions: number;
  similarAuctions: Array<{
    id: string;
    title: string;
    reservePrice: string;
    winningAmount: string | null;
    bidCount: number;
  }>;
  factors: {
    avgHistoricalReserve?: string;
    medianHistoricalReserve?: string;
    avgWinningAmount?: string;
    estimatedValue?: string;
    reserveToEstimateRatio?: number;
    participationRate?: number;
    calculation: string;
  };
}

/**
 * Calculate reserve price recommendation based on historical data
 * Uses statistical analysis of similar past auctions
 */
export async function getReservePriceRecommendation(
  auctionId: string,
  actor: { userId: string; roles: Role[]; organizationId?: string },
): Promise<ReservePriceRecommendationResult> {
  const auction = await auctionRepo.findById(auctionId);
  if (!auction) {
    throw new AppError("Auction not found", HttpStatus.NOT_FOUND);
  }

  // Authorization: only officers of the auction's org can get recommendations
  const isOfficer = actor.roles.some((r) =>
    ["org_admin", "auction_officer", "compliance_officer", "super_admin"].includes(r),
  );

  if (!isOfficer) {
    throw new AppError("Forbidden", HttpStatus.FORBIDDEN);
  }

  if (!actor.roles.includes("super_admin") && auction.orgId !== actor.organizationId) {
    throw new AppError("Forbidden", HttpStatus.FORBIDDEN);
  }

  // Check if we have a cached recommendation
  const cached = await repo.getRecommendation(auctionId);
  if (cached && cached.createdAt > new Date(Date.now() - 24 * 60 * 60 * 1000)) {
    // Return cached if less than 24 hours old
    const similarAuctions = await repo.getSimilarHistoricalAuctions(
      cached.categoryId ?? undefined,
      cached.region ?? undefined,
      cached.estimatedValue ? Number(cached.estimatedValue) : undefined,
      5,
    );

    return {
      recommendedReserve: cached.recommendedReserve,
      confidenceScore: cached.confidenceScore,
      basedOnAuctions: cached.basedOnAuctions,
      similarAuctions: similarAuctions.map((a) => ({
        id: a.id,
        title: a.title,
        reservePrice: a.reservePrice,
        winningAmount: a.winningAmount,
        bidCount: a.bidCount,
      })),
      factors: cached.factors as any,
    };
  }

  // Get auction items to determine category and estimated value
  const items = await auctionItemRepo.getAuctionItems(auctionId);
  const categoryId = items[0]?.categoryId;
  const estimatedValue = items.reduce(
    (sum: number, item) => sum + (item.estimatedValue ? Number(item.estimatedValue) : 0),
    0,
  );

  // Find similar historical auctions
  const similarAuctions = await repo.getSimilarHistoricalAuctions(
    categoryId,
    auction.region ?? undefined,
    estimatedValue > 0 ? estimatedValue : undefined,
    50,
  );

  if (similarAuctions.length < 5) {
    // Not enough data for reliable recommendation
    logger.warn({
      event: "analytics:insufficient_data",
      auctionId,
      categoryId,
      region: auction.region,
      foundAuctions: similarAuctions.length,
    });

    // Fallback: 70% of estimated value or 0
    const fallbackReserve = estimatedValue > 0 ? (estimatedValue * 0.7).toFixed(2) : "0.00";

    return {
      recommendedReserve: fallbackReserve,
      confidenceScore: 20,
      basedOnAuctions: 0,
      similarAuctions: [],
      factors: {
        calculation: "Insufficient historical data. Using 70% of estimated value as fallback.",
        estimatedValue: estimatedValue.toFixed(2),
        reserveToEstimateRatio: 0.7,
      },
    };
  }

  // Calculate statistics from similar auctions
  const reservePrices = similarAuctions.map((a) => Number(a.reservePrice)).filter((p) => p > 0);
  const winningAmounts = similarAuctions
    .map((a) => (a.winningAmount ? Number(a.winningAmount) : null))
    .filter((p): p is number => p !== null && p > 0);

  const avgReserve = reservePrices.reduce((a, b) => a + b, 0) / reservePrices.length;
  const medianReserve = [...reservePrices].sort((a, b) => a - b)[Math.floor(reservePrices.length / 2)];
  const avgWinning =
    winningAmounts.length > 0 ? winningAmounts.reduce((a, b) => a + b, 0) / winningAmounts.length : null;

  // Calculate recommended reserve
  let recommendedReserve: number;
  let calculationMethod: string;
  let confidenceScore: number;

  if (winningAmounts.length >= 10) {
    // High confidence: use median winning amount * 0.85 (slightly below typical winning)
    recommendedReserve = (avgWinning ?? avgReserve) * 0.85;
    calculationMethod = "median_winning_adjusted";
    confidenceScore = 85;
  } else if (reservePrices.length >= 20) {
    // Medium confidence: use historical reserve prices
    recommendedReserve = medianReserve;
    calculationMethod = "median_historical_reserve";
    confidenceScore = 70;
  } else if (estimatedValue > 0) {
    // Lower confidence: blend historical average with estimated value
    const blendedReserve = avgReserve * 0.6 + estimatedValue * 0.7 * 0.4;
    recommendedReserve = blendedReserve;
    calculationMethod = "blended_estimate";
    confidenceScore = 55;
  } else {
    // Lowest confidence: use historical average
    recommendedReserve = avgReserve;
    calculationMethod = "average_historical";
    confidenceScore = 40;
  }

  // Ensure reserve is reasonable (not too low, not higher than estimated value if available)
  if (estimatedValue > 0) {
    recommendedReserve = Math.min(recommendedReserve, estimatedValue * 0.9);
    recommendedReserve = Math.max(recommendedReserve, estimatedValue * 0.5);
  }

  // Round to reasonable precision
  recommendedReserve = Math.round(recommendedReserve * 100) / 100;

  const factors = {
    avgHistoricalReserve: avgReserve.toFixed(2),
    medianHistoricalReserve: medianReserve.toFixed(2),
    avgWinningAmount: avgWinning?.toFixed(2),
    estimatedValue: estimatedValue > 0 ? estimatedValue.toFixed(2) : undefined,
    reserveToEstimateRatio: estimatedValue > 0 ? recommendedReserve / estimatedValue : undefined,
    participationRate: similarAuctions.reduce((sum, a) => sum + a.bidCount, 0) / similarAuctions.length,
    calculation: calculationMethod,
  };

  // Save recommendation
  await repo.saveRecommendation(
    {
      auctionId,
      categoryId,
      region: auction.region ?? undefined,
      estimatedValue: estimatedValue > 0 ? estimatedValue.toFixed(2) : undefined,
      recommendedReserve: recommendedReserve.toFixed(2),
      confidenceScore,
      basedOnAuctions: similarAuctions.length,
      calculationMethod,
      factors,
      createdBy: actor.userId,
    },
  );

  logger.info({
    event: "analytics:recommendation_generated",
    auctionId,
    recommendedReserve: recommendedReserve.toFixed(2),
    confidenceScore,
    basedOnAuctions: similarAuctions.length,
  });

  return {
    recommendedReserve: recommendedReserve.toFixed(2),
    confidenceScore,
    basedOnAuctions: similarAuctions.length,
    similarAuctions: similarAuctions.slice(0, 5).map((a) => ({
      id: a.id,
      title: a.title,
      reservePrice: a.reservePrice,
      winningAmount: a.winningAmount,
      bidCount: a.bidCount,
    })),
    factors,
  };
}

/**
 * Get historical analytics for category and region
 */
export async function getHistoricalAnalytics(
  categoryId?: string,
  region?: string,
  months: number = 12,
  actor?: { roles: Role[] },
): Promise<repo.AuctionAnalytics[]> {
  // Analytics are public for officers, restricted for others
  if (actor && !actor.roles.some((r) => ["super_admin", "org_admin", "auction_officer", "compliance_officer"].includes(r))) {
    throw new AppError("Forbidden", HttpStatus.FORBIDDEN);
  }

  return repo.getHistoricalAnalytics(categoryId, region, months);
}

/**
 * Get participation insights for a bidder
 */
export async function getBidderInsights(
  bidderId: string,
  actor: { userId: string; roles: Role[] },
): Promise<repo.BidderParticipationMetrics[]> {
  // Users can see their own metrics, admins can see anyone's
  if (actor.userId !== bidderId && !actor.roles.includes("super_admin")) {
    throw new AppError("Forbidden", HttpStatus.FORBIDDEN);
  }

  return repo.getBidderMetrics(bidderId, 12);
}

/**
 * Refresh analytics materialized view
 * Called by scheduled job
 */
export async function refreshAnalytics(): Promise<void> {
  logger.info({ event: "analytics:refresh_started" });
  await repo.refreshAnalytics();
  logger.info({ event: "analytics:refresh_completed" });
}

/**
 * Update bidder metrics for a period
 * Called by scheduled job
 */
export async function updateBidderMetrics(period?: Date): Promise<void> {
  const targetPeriod = period ?? new Date();
  logger.info({ event: "analytics:update_bidder_metrics_started", period: targetPeriod });
  await repo.updateBidderMetrics(targetPeriod);
  logger.info({ event: "analytics:update_bidder_metrics_completed" });
}
