import type { RequestHandler } from "express";
import type {
  AssignDisputeRequest,
  OpenDisputeRequest,
  OptionalAuctionScopedQuery,
  ResolveDisputeRequest,
} from "@auction/shared";
import { AppError, HttpStatus } from "../shared/errors/index.js";
import { getAuth, routeParam } from "../shared/types/request.js";
import * as service from "./dispute.service.js";

const REVIEWER_ROLES = ["compliance_officer", "org_admin", "auction_officer", "super_admin"];

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
  res.status(HttpStatus.CREATED).json(dispute);
};

export const list: RequestHandler = async (req, res) => {
  const auth = getAuth(req);
  const { auctionId } = req.query as unknown as OptionalAuctionScopedQuery;
  const items = await service.listDisputes({
    viewerId: auth.userId,
    roles: auth.roles,
    auctionId,
  });
  res.json({ items });
};

export const getById: RequestHandler = async (req, res) => {
  const auth = getAuth(req);
  const dispute = await service.getDispute(routeParam(req.params.id));

  const isReviewer = auth.roles.some((role) => REVIEWER_ROLES.includes(role));
  if (!isReviewer && dispute.raisedBy !== auth.userId) {
    throw new AppError("Forbidden", HttpStatus.FORBIDDEN, "FORBIDDEN");
  }

  res.json(dispute);
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
