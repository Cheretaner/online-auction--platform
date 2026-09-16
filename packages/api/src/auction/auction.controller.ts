import type { RequestHandler } from "express";
import type { CreateAuctionRequest } from "@auction/shared";
import { routeParam, type AuthenticatedRequest } from "../shared/types/request.js";
import * as service from "./auction.service.js";

export const create: RequestHandler = async (req, res, next) => {
  try {
    const auth = (req as AuthenticatedRequest).auth!;
    const body = req.body as CreateAuctionRequest;
    const auction = await service.createAuction({ ...body, createdBy: auth.userId });
    res.status(201).json(auction);
  } catch (error) {
    next(error);
  }
};

export const getById: RequestHandler = async (req, res, next) => {
  try {
    const auction = await service.getAuction(routeParam(req.params.id));
    res.json(auction);
  } catch (error) {
    next(error);
  }
};

export const transition: RequestHandler = async (req, res, next) => {
  try {
    const { status } = req.body as { status: string };
    const auction = await service.transitionAuction(routeParam(req.params.id), status as never);
    res.json(auction);
  } catch (error) {
    next(error);
  }
};
