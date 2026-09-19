import type { RequestHandler } from "express";
import * as AuctionService from "./auction.service.js";
import { getAuth, routeParam } from "../shared/types/request.js";

export const create: RequestHandler = async (req, res, next) => {
  try {
    const auth = getAuth(req);
    const orgId = auth.organizationId;
    const userId = auth.userId;
    if (!orgId) {
      res.status(403).json({ error: "User does not belong to an organization" });
      return;
    }
    const auction = await AuctionService.createAuction(orgId, userId, req.body);
    res.status(201).json(auction);
  } catch (error) {
    next(error);
  }
};

export const getById: RequestHandler = async (req, res, next) => {
  try {
    const id = routeParam(req.params.id);
    const auction = await AuctionService.getAuction(id);
    res.status(200).json(auction);
  } catch (error) {
    next(error);
  }
};

export const listPublic: RequestHandler = async (req, res, next) => {
  try {
    const auctions = await AuctionService.listPublicAuctions();
    res.status(200).json(auctions);
  } catch (error) {
    next(error);
  }
};

export const listByOrg: RequestHandler = async (req, res, next) => {
  try {
    const orgId = routeParam(req.params.orgId);
    if (getAuth(req).organizationId !== orgId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const auctions = await AuctionService.listByOrg(orgId);
    res.status(200).json(auctions);
  } catch (error) {
    next(error);
  }
};

export const submitForApproval: RequestHandler = async (req, res, next) => {
  try {
    const id = routeParam(req.params.id);
    const auth = getAuth(req);
    const orgId = auth.organizationId!;
    const userId = auth.userId;
    const auction = await AuctionService.submitForApproval(id, orgId, userId);
    res.status(200).json(auction);
  } catch (error) {
    next(error);
  }
};

export const approve: RequestHandler = async (req, res, next) => {
  try {
    const id = routeParam(req.params.id);
    const auth = getAuth(req);
    const orgId = auth.organizationId!;
    const userId = auth.userId;
    const auction = await AuctionService.approveAuction(id, orgId, userId);
    res.status(200).json(auction);
  } catch (error) {
    next(error);
  }
};

export const transition: RequestHandler = async (req, res, next) => {
  try {
    const id = routeParam(req.params.id);
    const orgId = getAuth(req).organizationId!;
    const { status } = req.body;
    const auction = await AuctionService.transitionAuction(id, orgId, status);
    res.status(200).json(auction);
  } catch (error) {
    next(error);
  }
};

export const amend: RequestHandler = async (req, res, next) => {
  try {
    const id = routeParam(req.params.id);
    const orgId = getAuth(req).organizationId!;
    const auction = await AuctionService.amendAuction(id, orgId, req.body);
    res.status(200).json(auction);
  } catch (error) {
    next(error);
  }
};

export const cancel: RequestHandler = async (req, res, next) => {
  try {
    const id = routeParam(req.params.id);
    const orgId = getAuth(req).organizationId!;
    const auction = await AuctionService.cancelAuction(id, orgId);
    res.status(200).json(auction);
  } catch (error) {
    next(error);
  }
};
