import type { RequestHandler } from "express";
import { PaginationQuery } from "../shared/types/pagination.js";
import { getAuth, routeParam } from "../shared/types/request.js";
import * as service from "./audit.service.js";
import * as AuctionService from "../auction/auction.service.js";
import { AppError, HttpStatus } from "../shared/errors/index.js";
import { assertAuctionAccess } from "../shared/authz/auction-access.js";

export const list: RequestHandler = async (req, res) => {
  const auth = getAuth(req);
  const query = PaginationQuery.parse(req.query);
  const auctionId = typeof req.query.auctionId === "string" ? req.query.auctionId : undefined;
  const entityType = typeof req.query.entityType === "string" ? req.query.entityType : undefined;
  const entityId = typeof req.query.entityId === "string" ? req.query.entityId : undefined;
  if (auctionId) {
    await assertAuctionAccess(auctionId, {
      userId: auth.userId,
      roles: auth.roles,
      organizationId: auth.organizationId,
    });
  }
  const orgId = auth.roles.includes("super_admin") || auctionId ? undefined : auth.organizationId ?? undefined;
  if (!auctionId && !orgId && !auth.roles.includes("super_admin")) {
    throw new AppError("Select an organization to view its audit events", HttpStatus.FORBIDDEN, "ORG_CONTEXT_REQUIRED");
  }
  const result = await service.listAuditEvents({
    auctionId,
    entityType,
    entityId,
    orgId,
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

export const exportAnalytics: RequestHandler = async (req, res) => {
  const auth = getAuth(req);
  if (!auth.organizationId) {
    throw new AppError("Select an organization before exporting its audit analytics", HttpStatus.FORBIDDEN, "ORG_CONTEXT_REQUIRED");
  }
  const rows = await service.exportOrganizationAnalytics(auth.organizationId);
  const escape = (value: string) => `"${value.replaceAll('"', '""')}"`;
  const csv = [
    ["event_date_utc", "actor_role", "entity_type", "action", "event_count"].join(","),
    ...rows.map((row) => [row.eventDate, row.actorRole, row.entityType, row.action, row.eventCount].map(escape).join(",")),
  ].join("\r\n");
  res
    .status(200)
    .set({
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=organization-audit-analytics-90d.csv",
      "Cache-Control": "private, no-store",
    })
    .send(csv);
};

export const verifyPublicAuction: RequestHandler = async (req, res) => {
  const auctionId = routeParam(req.params.auctionId);
  const auction = await AuctionService.getAuction(auctionId);
  if (auction.status !== "closed" && auction.status !== "awarded") {
    throw new AppError("Public verification is available after an auction closes", HttpStatus.NOT_FOUND);
  }

  const verification = await service.verifyAuditChain(auctionId);
  res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
  res.json({ auctionId, status: auction.status, checkedAt: new Date().toISOString(), ...verification });
};
