import type { RequestHandler } from "express";
import { getAuth, routeParam } from "../shared/types/request.js";
import * as service from "./document-search.service.js";
import { HttpStatus } from "../shared/errors/index.js";
import { logger } from "../shared/utils/logger.js";

/**
 * GET /api/v1/documents/search
 * Search across OCR extracted text in documents
 *
 * Query params:
 * - q: search query (required, min 2 characters)
 * - auctionId: filter by auction (optional)
 * - documentType: filter by type (optional)
 * - language: 'english' | 'amharic' | 'both' (optional, default: both)
 * - limit: results per page (optional, default: 50, max: 100)
 * - offset: pagination offset (optional, default: 0)
 */
export const searchDocuments: RequestHandler = async (req, res, next) => {
  try {
    const auth = getAuth(req);
    const { q, auctionId, documentType, language, limit, offset } = req.query;

    if (!q || typeof q !== "string") {
      res.status(HttpStatus.BAD_REQUEST).json({
        error: "BAD_REQUEST",
        message: "Query parameter 'q' is required",
      });
      return;
    }

    const result = await service.searchDocuments({
      query: q,
      auctionId: typeof auctionId === "string" ? auctionId : undefined,
      documentType: typeof documentType === "string" ? documentType : undefined,
      language:
        language === "english" || language === "amharic" || language === "both"
          ? language
          : "both",
      limit: limit ? Number(limit) : 50,
      offset: offset ? Number(offset) : 0,
      viewer: {
        userId: auth.userId,
        roles: auth.roles,
        organizationId: auth.organizationId,
      },
    });

    logger.info({
      event: "document:search",
      userId: auth.userId,
      query: q,
      resultsCount: result.items.length,
      total: result.total,
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/auctions/:auctionId/documents/search
 * Search documents within a specific auction
 */
export const searchAuctionDocuments: RequestHandler = async (req, res, next) => {
  try {
    const auth = getAuth(req);
    const auctionId = routeParam(req.params.auctionId);
    const { q } = req.query;

    if (!q || typeof q !== "string") {
      res.status(HttpStatus.BAD_REQUEST).json({
        error: "BAD_REQUEST",
        message: "Query parameter 'q' is required",
      });
      return;
    }

    const results = await service.searchAuctionDocuments(auctionId, q, {
      userId: auth.userId,
      roles: auth.roles,
      organizationId: auth.organizationId,
    });

    logger.info({
      event: "document:search_auction",
      userId: auth.userId,
      auctionId,
      query: q,
      resultsCount: results.length,
    });

    res.json({ items: results, query: q, auctionId });
  } catch (error) {
    next(error);
  }
};
