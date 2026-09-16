import type { RequestHandler } from "express";
import * as service from "./audit.service.js";

export const record: RequestHandler = async (req, res, next) => {
  try {
    const event = await service.recordAuditEvent(req.body);
    res.status(201).json(event);
  } catch (error) {
    next(error);
  }
};
