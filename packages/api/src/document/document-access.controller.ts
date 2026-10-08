import type { RequestHandler } from "express";
import { getAuth, routeParam } from "../shared/types/request.js";
import * as service from "./document-access.service.js";

export const initiate: RequestHandler = async (req, res) => {
  const auth = getAuth(req);
  res.status(201).json(await service.initiateDocumentAccess(
    { userId: auth.userId, roles: auth.roles },
    routeParam(req.params.auctionId),
  ));
};

export const status: RequestHandler = async (req, res) => {
  const auth = getAuth(req);
  res.json(await service.getDocumentAccessStatus(
    routeParam(req.params.auctionId),
    auth.userId,
    false,
  ));
};

export const verify: RequestHandler = async (req, res) => {
  const auth = getAuth(req);
  res.json(await service.getDocumentAccessStatus(
    routeParam(req.params.auctionId),
    auth.userId,
    true,
  ));
};
