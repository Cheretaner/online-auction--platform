import type { RequestHandler } from "express";
import type { AssignDisputeRequest, OpenDisputeRequest, ResolveDisputeRequest } from "@auction/shared";
import { getAuth, routeParam } from "../shared/types/request.js";
import * as service from "./dispute.service.js";

export const create: RequestHandler = async (req, res) => {
  const auth = getAuth(req);
  const body = req.body as OpenDisputeRequest;
  const dispute = await service.openDispute({
    auctionId: body.auctionId,
    raisedBy: auth.userId,
    roles: auth.roles,
    reason: body.reason,
    evidence: body.evidence,
  });
  res.status(201).json(dispute);
};

export const list: RequestHandler = async (req, res) => {
  const auth = getAuth(req);
  const auctionId = typeof req.query.auctionId === "string" ? req.query.auctionId : undefined;
  const items = await service.listDisputes({
    viewerId: auth.userId,
    roles: auth.roles,
    auctionId,
  });
  res.json({ items });
};

export const assign: RequestHandler = async (req, res) => {
  const auth = getAuth(req);
  const body = req.body as AssignDisputeRequest;
  const dispute = await service.assignDispute({
    id: routeParam(req.params.id),
    actorId: auth.userId,
    roles: auth.roles,
    reviewerId: body.reviewerId,
  });
  res.json(dispute);
};

export const resolve: RequestHandler = async (req, res) => {
  const auth = getAuth(req);
  const body = req.body as ResolveDisputeRequest;
  const dispute = await service.resolveDispute({
    id: routeParam(req.params.id),
    actorId: auth.userId,
    roles: auth.roles,
    status: body.status,
    decision: body.decision,
    decisionReason: body.decisionReason,
  });
  res.json(dispute);
};
