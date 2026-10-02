import type { RequestHandler } from "express";
import type { AuctionScopedQuery, CreateDepositRequest, ReleaseDepositRequest, ReviewDepositRequest } from "@auction/shared";
import { AppError, HttpStatus } from "../shared/errors/index.js";
import { getAuth, routeParam } from "../shared/types/request.js";
import { assertAuctionAccess } from "../shared/authz/auction-access.js";
import * as audit from "../audit/audit.service.js";
import * as service from "./deposit.service.js";
import * as paymentService from "../payments/payment.service.js";

export const create: RequestHandler = async (req, res) => {
  const auth = getAuth(req);
  const deposit = await service.createDeposit(
    { userId: auth.userId, roles: auth.roles },
    req.body as CreateDepositRequest,
  );
  res.status(HttpStatus.CREATED).json(deposit);
};

export const initiateChapa: RequestHandler = async (req, res) => {
  const auth = getAuth(req);
  const result = await paymentService.initiateChapaDeposit(
    { userId: auth.userId, roles: auth.roles },
    req.body,
  );
  res.status(result.checkoutUrl ? HttpStatus.CREATED : HttpStatus.OK).json(result);
};

export const paymentProviders: RequestHandler = (_req, res) => {
  res.json(paymentService.chapaPaymentOptions());
};

/** Reviewing or releasing a deposit is an act on behalf of the auction's
 * organization, so the caller must be an officer of that organization
 * (or a super admin), not merely an officer somewhere. */
async function assertDepositOrgAccess(depositId: string, auth: ReturnType<typeof getAuth>): Promise<void> {
  const deposit = await service.getDeposit(depositId);
  await assertAuctionAccess(deposit.auctionId, {
    userId: auth.userId,
    roles: auth.roles,
    organizationId: auth.organizationId,
  });
}

export const review: RequestHandler = async (req, res) => {
  const auth = getAuth(req);
  await assertDepositOrgAccess(routeParam(req.params.id), auth);
  const deposit = await service.reviewDeposit(
    routeParam(req.params.id),
    { userId: auth.userId, roles: auth.roles },
    req.body as ReviewDepositRequest,
  );
  res.json(deposit);
};

export const release: RequestHandler = async (req, res) => {
  const auth = getAuth(req);
  await assertDepositOrgAccess(routeParam(req.params.id), auth);
  const deposit = await service.releaseDeposit(routeParam(req.params.id), {
    userId: auth.userId,
    roles: auth.roles,
  }, req.body as ReleaseDepositRequest);
  res.json(deposit);
};

export const getById: RequestHandler = async (req, res) => {
  const auth = getAuth(req);
  const deposit = await service.getDeposit(routeParam(req.params.id));

  // A deposit carries bank instrument details, so a bidder may only read
  // their own; otherwise the caller must be an officer of the auction's
  // organization.
  if (deposit.bidderId !== auth.userId) {
    const isOfficer = auth.roles.some((role) =>
      ["auction_officer", "org_admin", "compliance_officer", "super_admin"].includes(role),
    );
    if (!isOfficer) throw new AppError("Forbidden", HttpStatus.FORBIDDEN, "FORBIDDEN");
    await assertAuctionAccess(deposit.auctionId, {
      userId: auth.userId,
      roles: auth.roles,
      organizationId: auth.organizationId,
    });
  }

  await audit.appendAuditEvent({
    auctionId: deposit.auctionId,
    actorId: auth.userId,
    actorRole: audit.actorRoleOf(auth.roles),
    entityType: "deposit",
    entityId: deposit.id,
    action: "deposit.details_viewed",
    payload: { viewerIsOwner: deposit.bidderId === auth.userId },
  });

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

  const items = await service.listByAuction(auctionId);
  await audit.appendAuditEvent({
    auctionId,
    actorId: auth.userId,
    actorRole: audit.actorRoleOf(auth.roles),
    entityType: "auction",
    entityId: auctionId,
    action: "deposit.details_listed",
    payload: { depositCount: items.length },
  });
  res.json({ items });
};

export const listMine: RequestHandler = async (req, res) => {
  const auth = getAuth(req);
  const items = await service.listByBidder(auth.userId);
  await audit.appendAuditEvent({
    auctionId: null,
    actorId: auth.userId,
    actorRole: audit.actorRoleOf(auth.roles),
    entityType: "profile",
    entityId: auth.userId,
    action: "deposit.details_listed",
    payload: { depositCount: items.length },
  });
  res.json({ items });
};
