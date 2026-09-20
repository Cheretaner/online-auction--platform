import type { RequestHandler } from "express";
import { PaginationQuery } from "../shared/types/pagination.js";
import { routeParam } from "../shared/types/request.js";
import * as service from "./audit.service.js";

export const list: RequestHandler = async (req, res) => {
  const query = PaginationQuery.parse(req.query);
  const auctionId = typeof req.query.auctionId === "string" ? req.query.auctionId : undefined;
  const entityType = typeof req.query.entityType === "string" ? req.query.entityType : undefined;
  const entityId = typeof req.query.entityId === "string" ? req.query.entityId : undefined;
  const result = await service.listAuditEvents({
    auctionId,
    entityType,
    entityId,
    page: query.page,
    limit: query.limit,
  });
  res.json(result);
};

export const verify: RequestHandler = async (req, res) => {
  // Omitting auctionId verifies the global ledger (events not tied to a
  // single auction, e.g. KYC and organization changes).
  const auctionId = typeof req.query.auctionId === "string" && req.query.auctionId.length > 0
    ? req.query.auctionId
    : undefined;
  const verification = await service.verifyAuditChain(auctionId);
  res.json(verification);
};

export const verifyAuction: RequestHandler = async (req, res) => {
  const verification = await service.verifyAuditChain(routeParam(req.params.auctionId));
  res.json(verification);
};
