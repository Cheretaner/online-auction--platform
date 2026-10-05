import type { RequestHandler } from "express";
import { getAuth, routeParam } from "../shared/types/request.js";
import * as service from "./watchlist.service.js";
import { HttpStatus } from "../shared/errors/index.js";
import { logger } from "../shared/utils/logger.js";
import { NOTIFICATION_CHANNEL } from "@auction/shared";
import { z } from "zod";

/** GET /api/v1/watchlists */
export const list: RequestHandler = async (req, res, next) => {
  try {
    res.json({ items: await service.listWatchlists(getAuth(req).userId) });
  } catch (error) {
    next(error);
  }
};

/** PUT /api/v1/watchlists/:auctionId */
export const replace: RequestHandler = async (req, res, next) => {
  try {
    const auth = getAuth(req);
    const body = z.object({
      channels: z.array(z.enum(NOTIFICATION_CHANNEL)).min(1).max(NOTIFICATION_CHANNEL.length),
      alertOnBids: z.boolean(),
      alertOnStatus: z.boolean(),
    }).strict().parse(req.body);
    await service.setWatchlist({
      userId: auth.userId,
      auctionId: routeParam(req.params.auctionId),
      ...body,
    });
    res.status(HttpStatus.NO_CONTENT).end();
  } catch (error) {
    next(error);
  }
};

/** DELETE /api/v1/watchlists/:auctionId */
export const remove: RequestHandler = async (req, res, next) => {
  try {
    await service.removeWatchlist(getAuth(req).userId, routeParam(req.params.auctionId));
    res.status(HttpStatus.NO_CONTENT).end();
  } catch (error) {
    next(error);
  }
};

/** POST /api/v1/watchlist */
export const addToWatchlist: RequestHandler = async (req, res, next) => {
  try {
    const auth = getAuth(req);
    const { auctionId, notes, notifyOnBid, notifyOnStatusChange, notifyOnClosingSoon } = req.body;

    if (!auctionId) {
      res.status(HttpStatus.BAD_REQUEST).json({ error: "BAD_REQUEST", message: "auctionId is required" });
      return;
    }

    const item = await service.addToWatchlist({
      userId: auth.userId,
      auctionId,
      notes,
      notifyOnBid,
      notifyOnStatusChange,
      notifyOnClosingSoon,
    });

    logger.info({ event: "watchlist:add_api", userId: auth.userId, auctionId });

    res.status(HttpStatus.CREATED).json(item);
  } catch (error) {
    next(error);
  }
};

/** DELETE /api/v1/watchlist/:auctionId */
export const removeFromWatchlist: RequestHandler = async (req, res, next) => {
  try {
    const auth = getAuth(req);
    const auctionId = routeParam(req.params.auctionId);

    await service.removeFromWatchlist(auth.userId, auctionId);

    logger.info({ event: "watchlist:remove_api", userId: auth.userId, auctionId });

    res.status(HttpStatus.NO_CONTENT).send();
  } catch (error) {
    next(error);
  }
};

/** GET /api/v1/watchlist */
export const getWatchlist: RequestHandler = async (req, res, next) => {
  try {
    const auth = getAuth(req);
    const { limit, offset } = z.object({
      limit: z.coerce.number().int().min(1).max(100).default(50),
      offset: z.coerce.number().int().min(0).default(0),
    }).strict().parse(req.query);

    const result = await service.getUserWatchlist(auth.userId, limit, offset);

    res.json(result);
  } catch (error) {
    next(error);
  }
};

/** POST /api/v1/saved-searches */
export const createSavedSearch: RequestHandler = async (req, res, next) => {
  try {
    const auth = getAuth(req);
    const { name, description, searchCriteria, notifyOnMatch } = req.body;

    if (!name || !searchCriteria) {
      res.status(HttpStatus.BAD_REQUEST).json({ error: "BAD_REQUEST", message: "name and searchCriteria are required" });
      return;
    }

    const search = await service.createSavedSearch({
      userId: auth.userId,
      name,
      description,
      searchCriteria,
      notifyOnMatch,
    });

    logger.info({ event: "saved_search:create_api", userId: auth.userId, searchId: search.id });

    res.status(HttpStatus.CREATED).json(search);
  } catch (error) {
    next(error);
  }
};

/** PATCH /api/v1/saved-searches/:id */
export const updateSavedSearch: RequestHandler = async (req, res, next) => {
  try {
    const auth = getAuth(req);
    const id = routeParam(req.params.id);
    const { name, description, searchCriteria, isActive, notifyOnMatch } = req.body;

    const search = await service.updateSavedSearch(id, auth.userId, {
      name,
      description,
      searchCriteria,
      isActive,
      notifyOnMatch,
    });

    logger.info({ event: "saved_search:update_api", userId: auth.userId, searchId: id });

    res.json(search);
  } catch (error) {
    next(error);
  }
};

/** DELETE /api/v1/saved-searches/:id */
export const deleteSavedSearch: RequestHandler = async (req, res, next) => {
  try {
    const auth = getAuth(req);
    const id = routeParam(req.params.id);

    await service.deleteSavedSearch(id, auth.userId);

    logger.info({ event: "saved_search:delete_api", userId: auth.userId, searchId: id });

    res.status(HttpStatus.NO_CONTENT).send();
  } catch (error) {
    next(error);
  }
};

/** GET /api/v1/saved-searches */
export const getSavedSearches: RequestHandler = async (req, res, next) => {
  try {
    const auth = getAuth(req);
    const searches = await service.getUserSavedSearches(auth.userId);
    res.json({ items: searches });
  } catch (error) {
    next(error);
  }
};

/** POST /api/v1/notification-preferences */
export const setNotificationPreference: RequestHandler = async (req, res, next) => {
  try {
    const auth = getAuth(req);
    const { eventType, channel, enabled } = req.body;

    if (!eventType || !channel || enabled === undefined) {
      res.status(HttpStatus.BAD_REQUEST).json({
        error: "BAD_REQUEST",
        message: "eventType, channel, and enabled are required",
      });
      return;
    }

    const pref = await service.setNotificationPreference({
      userId: auth.userId,
      eventType,
      channel,
      enabled,
    });

    logger.info({ event: "notification_preference:set_api", userId: auth.userId, eventType, channel });

    res.json(pref);
  } catch (error) {
    next(error);
  }
};

/** GET /api/v1/notification-preferences */
export const getNotificationPreferences: RequestHandler = async (req, res, next) => {
  try {
    const auth = getAuth(req);
    const prefs = await service.getUserPreferences(auth.userId);
    res.json({ items: prefs });
  } catch (error) {
    next(error);
  }
};
