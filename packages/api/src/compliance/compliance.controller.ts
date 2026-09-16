import type { RequestHandler } from "express";
import { routeParam } from "../shared/types/request.js";
import * as service from "./compliance.service.js";

export const runCheck: RequestHandler = async (req, res, next) => {
  try {
    const { notes } = req.body as { notes?: string };
    const check = await service.runComplianceCheck(routeParam(req.params.auctionId), notes);
    res.status(201).json(check);
  } catch (error) {
    next(error);
  }
};

export const listChecks: RequestHandler = async (req, res, next) => {
  try {
    const checks = await service.listChecks(routeParam(req.params.auctionId));
    res.json({ items: checks });
  } catch (error) {
    next(error);
  }
};
