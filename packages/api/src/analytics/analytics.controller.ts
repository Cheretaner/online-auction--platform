import type { RequestHandler } from "express";
import { getAuth, routeParam } from "../shared/types/request.js";
import * as service from "./analytics.service.js";
import { logger } from "../shared/utils/logger.js";

/**
 * GET /api/v1/analytics/auctions/:auctionId/reserve-recommendation
 * Get AI-powered reserve price recommendation based on historical data
 */
export const getReserveRecommendation: RequestHandler = async (req, res, next) => {
  try {
    const auctionId = routeParam(req.params.auctionId);
    const auth = getAuth(req);

    const recommendation = await service.getReservePriceRecommendation(auctionId, {
      userId: auth.userId,
      roles: auth.roles,
      organizationId: auth.organizationId,
    });

    logger.info({
      event: "analytics:reserve_recommendation_viewed",
      auctionId,
      userId: auth.userId,
      recommendedReserve: recommendation.recommendedReserve,
    });

    res.json(recommendation);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/analytics/historical
 * Get historical analytics aggregated by category/region
 *
 * Query params:
 * - categoryId: filter by category (optional)
 * - region: filter by region (optional)
 * - months: number of months to return (default: 12, max: 24)
 */
export const getHistoricalAnalytics: RequestHandler = async (req, res, next) => {
  try {
    const auth = getAuth(req);
    const { categoryId, region, months } = req.query;

    const monthsNum = months ? Math.min(Number(months), 24) : 12;

    const analytics = await service.getHistoricalAnalytics(
      typeof categoryId === "string" ? categoryId : undefined,
      typeof region === "string" ? region : undefined,
      monthsNum,
      { roles: auth.roles },
    );

    logger.info({
      event: "analytics:historical_viewed",
      userId: auth.userId,
      categoryId,
      region,
      months: monthsNum,
      resultsCount: analytics.length,
    });

    res.json({ items: analytics, categoryId, region, months: monthsNum });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/analytics/bidders/:bidderId/insights
 * Get participation insights for a specific bidder
 */
export const getBidderInsights: RequestHandler = async (req, res, next) => {
  try {
    const bidderId = routeParam(req.params.bidderId);
    const auth = getAuth(req);

    const insights = await service.getBidderInsights(bidderId, {
      userId: auth.userId,
      roles: auth.roles,
    });

    logger.info({
      event: "analytics:bidder_insights_viewed",
      userId: auth.userId,
      bidderId,
      periodsCount: insights.length,
    });

    res.json({ items: insights, bidderId });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/analytics/me/insights
 * Get current user's participation insights
 */
export const getMyInsights: RequestHandler = async (req, res, next) => {
  try {
    const auth = getAuth(req);

    const insights = await service.getBidderInsights(auth.userId, {
      userId: auth.userId,
      roles: auth.roles,
    });

    logger.info({
      event: "analytics:my_insights_viewed",
      userId: auth.userId,
      periodsCount: insights.length,
    });

    res.json({ items: insights });
  } catch (error) {
    next(error);
  }
};
