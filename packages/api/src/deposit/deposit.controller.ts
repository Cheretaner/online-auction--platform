import type { RequestHandler } from "express";
import type { CreateDepositRequest, ReviewDepositRequest } from "@auction/shared";
import type { AuthenticatedRequest } from "../shared/types/request.js";
import { routeParam } from "../shared/types/request.js";
import * as service from "./deposit.service.js";

export const create: RequestHandler = async (req, res, next) => {
  try {
    const auth = (req as AuthenticatedRequest).auth!;
    const body = req.body as CreateDepositRequest;
    const deposit = await service.createDeposit(auth.userId, body);
    res.status(201).json(deposit);
  } catch (error) {
    next(error);
  }
};

export const review: RequestHandler = async (req, res, next) => {
  try {
    const auth = (req as AuthenticatedRequest).auth!;
    const body = req.body as ReviewDepositRequest;
    const deposit = await service.reviewDeposit(routeParam(req.params.id), auth.userId, body);
    res.json(deposit);
  } catch (error) {
    next(error);
  }
};

export const release: RequestHandler = async (req, res, next) => {
  try {
    const auth = (req as AuthenticatedRequest).auth!;
    const deposit = await service.releaseDeposit(routeParam(req.params.id), auth.userId);
    res.json(deposit);
  } catch (error) {
    next(error);
  }
};

export const getById: RequestHandler = async (req, res, next) => {
  try {
    const deposit = await service.getDeposit(routeParam(req.params.id));
    res.json(deposit);
  } catch (error) {
    next(error);
  }
};

export const listByAuction: RequestHandler = async (req, res, next) => {
  try {
    const auctionId = req.query.auctionId as string;
    const deposits = await service.listByAuction(auctionId);
    res.json({ items: deposits });
  } catch (error) {
    next(error);
  }
};
