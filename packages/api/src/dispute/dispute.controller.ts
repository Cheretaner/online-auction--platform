import type { RequestHandler } from "express";
import type {
  AssignDisputeRequest,
  OpenDisputeRequest,
  OptionalAuctionScopedQuery,
  ResolveDisputeRequest,
} from "@auction/shared";
import { AppError, HttpStatus } from "../shared/errors/index.js";
import { getAuth, routeParam } from "../shared/types/request.js";
import { assertAuctionAccess } from "../shared/authz/auction-access.js";
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
    organizationId: auth.organizationId,
    auctionId,
  });
  res.json({ items });
};

export const getById: RequestHandler = async (req, res) => {
  const auth = getAuth(req);
  const dispute = await service.getDispute(routeParam(req.params.id));

  if (dispute.raisedBy !== auth.userId) {
    const isReviewer = auth.roles.some((role) => REVIEWER_ROLES.includes(role));
    if (!isReviewer) throw new AppError("Forbidden", HttpStatus.FORBIDDEN, "FORBIDDEN");
    await assertDisputeOrgAccess(dispute.auctionId, auth);
  }

  res.json(dispute);
};

export const downloadEvidenceBundle: RequestHandler = async (req, res) => {
  const auth = getAuth(req);
  const id = routeParam(req.params.id);
  const dispute = await service.getDispute(id);
  await assertDisputeOrgAccess(dispute.auctionId, auth);
  const bundle = await service.createEvidenceBundle({ id, actorId: auth.userId, roles: auth.roles });
  res
    .status(200)
    .set({
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="dispute-${id}-evidence.json"`,
      "Cache-Control": "private, no-store",
    })
    .send(JSON.stringify(bundle, null, 2));
};

/** Reviewing a dispute is an act on behalf of the auction's organization. */
async function assertDisputeOrgAccess(auctionId: string, auth: ReturnType<typeof getAuth>): Promise<void> {
  await assertAuctionAccess(auctionId, {
    userId: auth.userId,
    roles: auth.roles,
    organizationId: auth.organizationId,
  });
}

export const assign: RequestHandler = async (req, res) => {
  const auth = getAuth(req);
  await assertDisputeOrgAccess((await service.getDispute(routeParam(req.params.id))).auctionId, auth);
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
  await assertDisputeOrgAccess((await service.getDispute(routeParam(req.params.id))).auctionId, auth);
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
