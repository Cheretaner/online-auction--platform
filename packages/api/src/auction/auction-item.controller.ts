import type { RequestHandler } from "express";
import type { CreateAuctionItemRequest, UpdateAuctionItemRequest } from "@auction/shared";
import { AppError, HttpStatus } from "../shared/errors/index.js";
import { getAuth, routeParam, type AuthenticatedRequest } from "../shared/types/request.js";
import { getAuction } from "./auction.service.js";
import * as service from "./auction-item.service.js";

function actorOf(req: Parameters<RequestHandler>[0]) {
  const auth = getAuth(req);
  return { userId: auth.userId, roles: auth.roles, organizationId: auth.organizationId };
}

export const createAuctionItem: RequestHandler = async (req, res) => {
  const item = await service.createAuctionItem(
    actorOf(req),
    routeParam(req.params.auctionId),
    req.body as CreateAuctionItemRequest,
  );
  res.status(HttpStatus.CREATED).json(item);
};

export const getAuctionItems: RequestHandler = async (req, res) => {
  const auctionId = routeParam(req.params.auctionId);
  // Lots of an unpublished auction follow the auction's own visibility.
  await getAuction(auctionId, (req as AuthenticatedRequest).auth);
  const items = await service.getAuctionItems(auctionId);
  // Wrapped in { items } to match every other list endpoint; this one used
  // to return a bare array, which meant clients needed a special case.
  res.json({ items });
};

export const getAuctionItem: RequestHandler = async (req, res) => {
  const auctionId = routeParam(req.params.auctionId);
  await getAuction(auctionId, (req as AuthenticatedRequest).auth);
  const item = await service.getAuctionItemById(routeParam(req.params.id));
  if (item.auctionId !== auctionId) {
    throw new AppError("Auction item not found", HttpStatus.NOT_FOUND);
  }
  res.json(item);
};

export const updateAuctionItem: RequestHandler = async (req, res) => {
  const item = await service.updateAuctionItem(
    actorOf(req),
    routeParam(req.params.auctionId),
    routeParam(req.params.id),
    req.body as UpdateAuctionItemRequest,
  );
  res.json(item);
};

export const deleteAuctionItem: RequestHandler = async (req, res) => {
  await service.deleteAuctionItem(
    actorOf(req),
    routeParam(req.params.auctionId),
    routeParam(req.params.id),
  );
  res.status(HttpStatus.NO_CONTENT).send();
};
