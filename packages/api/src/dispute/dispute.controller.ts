import type { RequestHandler } from "express";
import type { AuthenticatedRequest } from "../shared/types/request.js";
import * as service from "./dispute.service.js";

export const create: RequestHandler = async (req, res, next) => {
  try {
    const auth = (req as AuthenticatedRequest).auth!;
    const { auctionId, reason } = req.body as { auctionId: string; reason: string };
    const dispute = await service.openDispute({
      auctionId,
      raisedBy: auth.userId,
      reason,
    });
    res.status(201).json(dispute);
  } catch (error) {
    next(error);
  }
};

export const list: RequestHandler = async (_req, res, next) => {
  try {
    const items = await service.listDisputes();
    res.json({ items });
  } catch (error) {
    next(error);
  }
};
