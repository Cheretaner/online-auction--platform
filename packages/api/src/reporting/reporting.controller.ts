import type { RequestHandler } from "express";
import type { AuctionScopedQuery, GenerateReportRequest, OptionalAuctionScopedQuery } from "@auction/shared";
import { AppError, HttpStatus } from "../shared/errors/index.js";
import { assertAuctionAccess } from "../shared/authz/auction-access.js";
import { routeParam } from "../shared/types/request.js";
import type { AuthenticatedRequest } from "../shared/types/request.js";
import { getAuth } from "../shared/types/request.js";
import * as service from "./reporting.service.js";

export const generate: RequestHandler = async (req, res) => {
  const auth = getAuth(req);
  const body = req.body as GenerateReportRequest;

  // A report is the public transparency artefact for an auction, so it may
  // only be produced by the organization that ran it.
  await assertAuctionAccess(body.auctionId, {
    userId: auth.userId,
    roles: auth.roles,
    organizationId: auth.organizationId,
  });

  const report = await service.generateReport({
    auctionId: body.auctionId,
    type: body.type,
    actorId: auth.userId,
    roles: auth.roles,
    organizationId: auth.organizationId,
  });
  res.status(HttpStatus.CREATED).json(report);
};

export const list: RequestHandler = async (req, res) => {
  const auth = getAuth(req);
  const { auctionId } = req.query as unknown as OptionalAuctionScopedQuery;

  if (auctionId) {
    await assertAuctionAccess(auctionId, {
      userId: auth.userId,
      roles: auth.roles,
      organizationId: auth.organizationId,
    });
    res.json({ items: await service.listReports(auctionId) });
    return;
  }

  // Without an auction filter, return only what this organization owns.
  res.json({
    items: await service.listReportsForOrg(auth.organizationId, auth.roles.includes("super_admin")),
  });
};

export const financialReconciliation: RequestHandler = async (req, res) => {
  const auth = getAuth(req);
  const { auctionId } = req.query as unknown as AuctionScopedQuery;
  await assertAuctionAccess(auctionId, {
    userId: auth.userId,
    roles: auth.roles,
    organizationId: auth.organizationId,
  });
  res.json(await service.financialReconciliation({
    auctionId,
    actorId: auth.userId,
    roles: auth.roles,
  }));
};

export const getById: RequestHandler = async (req, res) => {
  const report = await service.getReport(routeParam(req.params.id));

  // Drafts stay internal until published.
  if (!report.publishedAt) {
    const auth = (req as AuthenticatedRequest).auth;
    const canSeeDraft = auth?.roles.some((role) =>
      ["compliance_officer", "org_admin", "auction_officer", "super_admin"].includes(role),
    );
    if (!canSeeDraft) {
      throw new AppError("Report not found", HttpStatus.NOT_FOUND, "REPORT_NOT_FOUND");
    }
  }

  res.json(report);
};

export const publish: RequestHandler = async (req, res) => {
  const auth = getAuth(req);
  const report = await service.publishReport({
    id: routeParam(req.params.id),
    actorId: auth.userId,
    roles: auth.roles,
  });
  res.json(report);
};
