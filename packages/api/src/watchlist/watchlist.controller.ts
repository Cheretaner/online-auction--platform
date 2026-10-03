import type { RequestHandler } from "express";
import { NOTIFICATION_CHANNEL } from "@auction/shared";
import { z } from "zod";
import { HttpStatus } from "../shared/errors/index.js";
import { getAuth, routeParam } from "../shared/types/request.js";
import * as service from "./watchlist.service.js";

export const list: RequestHandler = async (req, res) => {
  const auth = getAuth(req);
  res.json({ items: await service.listWatchlists(auth.userId) });
};

export const replace: RequestHandler = async (req, res) => {
  const auth = getAuth(req);
  const body = z.object({
    channels: z.array(z.enum(NOTIFICATION_CHANNEL)).min(1).max(NOTIFICATION_CHANNEL.length),
    alertOnBids: z.boolean(),
    alertOnStatus: z.boolean(),
  }).strict().parse(req.body);
  await service.setWatchlist({ userId: auth.userId, auctionId: routeParam(req.params.auctionId), ...body });
  res.status(HttpStatus.NO_CONTENT).end();
};

export const remove: RequestHandler = async (req, res) => {
  const auth = getAuth(req);
  await service.removeWatchlist(auth.userId, routeParam(req.params.auctionId));
  res.status(HttpStatus.NO_CONTENT).end();
};
