import type { RequestHandler } from "express";
import type { AuctionScopedQuery, CreateDepositRequest, ReviewDepositRequest } from "@auction/shared";
import { AppError, HttpStatus } from "../shared/errors/index.js";
import { getAuth, routeParam } from "../shared/types/request.js";
import { assertAuctionAccess } from "../shared/authz/auction-access.js";
import * as service from "./deposit.service.js";

export const create: RequestHandler = async (req, res) => {
  const auth = getAuth(req);
  const deposit = await service.createDeposit(
    { userId: auth.userId, roles: auth.roles },
    req.body as CreateDepositRequest,
  );
  res.status(HttpStatus.CREATED).json(deposit);
};

export const review: RequestHandler = async (req, res) => {
  const auth = getAuth(req);
  const deposit = await service.reviewDeposit(
    routeParam(req.params.id),
    { userId: auth.userId, roles: auth.roles },
    req.body as ReviewDepositRequest,
  );
  res.json(deposit);
};

export const release: RequestHandler = async (req, res) => {
  const auth = getAuth(req);
  const deposit = await service.releaseDeposit(routeParam(req.params.id), {
    userId: auth.userId,
    roles: auth.roles,
  });
  res.json(deposit);
};

export const getById: RequestHandler = async (req, res) => {
  const auth = getAuth(req);
  const deposit = await service.getDeposit(routeParam(req.params.id));

  // A deposit carries bank instrument details, so a bidder may only read
  // their own; officers may read any.
  const isOfficer = auth.roles.some((role) =>
    ["auction_officer", "org_admin", "compliance_officer", "super_admin"].includes(role),
  );
  if (!isOfficer && deposit.bidderId !== auth.userId) {
    throw new AppError("Forbidden", HttpStatus.FORBIDDEN, "FORBIDDEN");
  }

  res.json(deposit);
};

export const listByAuction: RequestHandler = async (req, res) => {
  const auth = getAuth(req);
  const { auctionId } = req.query as unknown as AuctionScopedQuery;

  // Deposits carry bank instrument details. Holding an officer role proved
  // only that the caller was an officer somewhere, not an officer of the
  // organization running this auction.
  await assertAuctionAccess(auctionId, {
    userId: auth.userId,
    roles: auth.roles,
    organizationId: auth.organizationId,
  });

  res.json({ items: await service.listByAuction(auctionId) });
};

export const listMine: RequestHandler = async (req, res) => {
  const auth = getAuth(req);
  res.json({ items: await service.listByBidder(auth.userId) });
};
