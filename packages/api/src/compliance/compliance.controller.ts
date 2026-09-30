import type { RequestHandler } from "express";
import type { RunComplianceRequest } from "@auction/shared";
import { HttpStatus } from "../shared/errors/index.js";
import { assertAuctionAccess } from "../shared/authz/auction-access.js";
import { getAuth, routeParam } from "../shared/types/request.js";
import * as service from "./compliance.service.js";

export const runCheck: RequestHandler = async (req, res) => {
  const auth = getAuth(req);
  const auctionId = routeParam(req.params.auctionId);
  const body = req.body as RunComplianceRequest;

  // A compliance officer at one organization must not be able to sign off
  // on another organization's auction.
  await assertAuctionAccess(auctionId, {
    userId: auth.userId,
    roles: auth.roles,
    organizationId: auth.organizationId,
  });

  const check = await service.runComplianceCheck({
    auctionId,
    actorId: auth.userId,
    roles: auth.roles,
    organizationId: auth.organizationId,
    notes: body.notes,
  });
  res.status(HttpStatus.CREATED).json(check);
};

export const listChecks: RequestHandler = async (req, res) => {
  const auth = getAuth(req);
  const auctionId = routeParam(req.params.auctionId);

  await assertAuctionAccess(auctionId, {
    userId: auth.userId,
    roles: auth.roles,
    organizationId: auth.organizationId,
  });

  res.json({ items: await service.listChecks(auctionId) });
};
