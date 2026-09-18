import type { RequestHandler } from "express";
import type { GenerateReportRequest } from "@auction/shared";
import { getAuth, routeParam } from "../shared/types/request.js";
import * as service from "./reporting.service.js";

export const generate: RequestHandler = async (req, res) => {
  const auth = getAuth(req);
  const body = req.body as GenerateReportRequest;
  const report = await service.generateReport({
    auctionId: body.auctionId,
    type: body.type,
    actorId: auth.userId,
    roles: auth.roles,
    organizationId: auth.organizationId,
  });
  res.status(201).json(report);
};

export const list: RequestHandler = async (req, res) => {
  const auctionId = typeof req.query.auctionId === "string" ? req.query.auctionId : undefined;
  const items = await service.listReports(auctionId);
  res.json({ items });
};

export const getById: RequestHandler = async (req, res) => {
  const report = await service.getReport(routeParam(req.params.id));
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
