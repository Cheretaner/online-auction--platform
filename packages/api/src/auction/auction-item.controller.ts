import type { RequestHandler } from "express";
import type { AuthenticatedRequest } from "../shared/types/request.js";
import { routeParam } from "../shared/types/request.js";
import * as service from "./auction-item.service.js";
import type { CreateAuctionItemRequest, UpdateAuctionItemRequest } from "@auction/shared";
import { HttpStatus } from "../shared/errors/index.js";

export const createAuctionItem: RequestHandler = async (req, res, next) => {
  try {
    const userId = (req as AuthenticatedRequest).user.id;
    const auctionId = routeParam(req, 'auctionId');
    const data = req.body as CreateAuctionItemRequest;
    
    const item = await service.createAuctionItem(userId, auctionId, data);
    res.status(HttpStatus.CREATED).json(item);
  } catch (error) {
    next(error);
  }
};

export const getAuctionItems: RequestHandler = async (req, res, next) => {
  try {
    const auctionId = routeParam(req, 'auctionId');
    const items = await service.getAuctionItems(auctionId);
    res.status(HttpStatus.OK).json(items);
  } catch (error) {
    next(error);
  }
};

export const getAuctionItem: RequestHandler = async (req, res, next) => {
  try {
    const id = routeParam(req, 'id');
    const item = await service.getAuctionItemById(id);
    res.status(HttpStatus.OK).json(item);
  } catch (error) {
    next(error);
  }
};

export const updateAuctionItem: RequestHandler = async (req, res, next) => {
  try {
    const userId = (req as AuthenticatedRequest).user.id;
    const auctionId = routeParam(req, 'auctionId');
    const id = routeParam(req, 'id');
    const data = req.body as UpdateAuctionItemRequest;
    
    const item = await service.updateAuctionItem(userId, auctionId, id, data);
    res.status(HttpStatus.OK).json(item);
  } catch (error) {
    next(error);
  }
};

export const deleteAuctionItem: RequestHandler = async (req, res, next) => {
  try {
    const userId = (req as AuthenticatedRequest).user.id;
    const auctionId = routeParam(req, 'auctionId');
    const id = routeParam(req, 'id');
    
    await service.deleteAuctionItem(userId, auctionId, id);
    res.status(HttpStatus.NO_CONTENT).send();
  } catch (error) {
    next(error);
  }
};
