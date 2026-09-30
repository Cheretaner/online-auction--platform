import type { RequestHandler } from "express";
import type { PlaceBidRequest, WithdrawBidRequest } from "@auction/shared";
import { getAuth, routeParam } from "../shared/types/request.js";
import * as service from "./bidding.service.js";

export const placeBid: RequestHandler = async (req, res) => {
  const auth = getAuth(req);
  const body = req.body as PlaceBidRequest;
  const result = await service.placeBid({
    auctionId: routeParam(req.params.auctionId),
    bidderId: auth.userId,
    roles: auth.roles,
    organizationId: auth.organizationId,
    body,
    idempotencyKey: req.header("Idempotency-Key") ?? undefined,
    ip: req.ip,
  });
  res.status(201).json({
    bidId: result.bid.id,
    // The bidder always sees their own amount back — it is their receipt.
    amount: result.bid.amount,
    isSealed: result.bid.isSealed,
    commitmentHash: result.bid.commitmentHash,
    placedAt: result.bid.placedAt,
    auction: result.auction,
    audit: result.audit,
  });
};

export const listBids: RequestHandler = async (req, res) => {
  const auth = getAuth(req);
  const items = await service.listBids({
    auctionId: routeParam(req.params.auctionId),
    viewerId: auth.userId,
    roles: auth.roles,
  });
  res.json({ items });
};

export const withdrawBid: RequestHandler = async (req, res) => {
  const auth = getAuth(req);
  const body = req.body as WithdrawBidRequest;
  const bid = await service.withdrawBid({
    auctionId: routeParam(req.params.auctionId),
    bidId: routeParam(req.params.bidId),
    bidderId: auth.userId,
    roles: auth.roles,
    reason: body.reason,
  });
  res.json(bid);
};

export const openSealed: RequestHandler = async (req, res) => {
  const auth = getAuth(req);
  const result = await service.openSealedBids({
    auctionId: routeParam(req.params.auctionId),
    actorId: auth.userId,
    roles: auth.roles,
    organizationId: auth.organizationId,
  });
  res.json(result);
};
