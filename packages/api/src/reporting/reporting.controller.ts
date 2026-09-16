import type { RequestHandler } from "express";
import { AppError, HttpStatus } from "../shared/errors/index.js";
import { routeParam } from "../shared/types/request.js";
import * as service from "./reporting.service.js";
import type { ReportRequest } from "./reporting.types.js";

export const generate: RequestHandler = async (req, res, next) => {
  try {
    const report = await service.generateReport(req.body as ReportRequest);
    res.status(201).json(report);
  } catch (error) {
    next(error);
  }
};

export const getById: RequestHandler = async (req, res, next) => {
  try {
    const report = await service.getReport(routeParam(req.params.id));
    if (!report) throw new AppError("Report not found", HttpStatus.NOT_FOUND);
    res.json(report);
  } catch (error) {
    next(error);
  }
};
