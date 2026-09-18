import type { RequestHandler } from "express";
import type { RunComplianceRequest } from "@auction/shared";
import { getAuth, routeParam } from "../shared/types/request.js";
import * as service from "./compliance.service.js";

export const runCheck: RequestHandler = async (req, res) => {
  const auth = getAuth(req);
  const body = req.body as RunComplianceRequest;
  const check = await service.runComplianceCheck({
    auctionId: routeParam(req.params.auctionId),
    actorId: auth.userId,
    roles: auth.roles,
    organizationId: auth.organizationId,
    notes: body.notes,
  });
  res.status(201).json(check);
};

export const listChecks: RequestHandler = async (req, res) => {
  const checks = await service.listChecks(routeParam(req.params.auctionId));
  res.json({ items: checks });
};
