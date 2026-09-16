import type { RequestHandler } from "express";
import type { PlaceBidRequest } from "@auction/shared";
import { routeParam, type AuthenticatedRequest } from "../shared/types/request.js";
import * as service from "./bidding.service.js";

export const placeBid: RequestHandler = async (req, res, next) => {
  try {
    const auth = (req as AuthenticatedRequest).auth!;
    const body = req.body as PlaceBidRequest;
    const idempotencyKey = req.header("Idempotency-Key") ?? undefined;
    const bid = await service.placeBid(routeParam(req.params.auctionId), auth.userId, body, idempotencyKey);
    res.status(201).json(bid);
  } catch (error) {
    next(error);
  }
};
