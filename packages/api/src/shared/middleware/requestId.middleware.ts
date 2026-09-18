import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";

export const requestIdMiddleware: RequestHandler = (req, res, next) => {
  const header = req.header("x-request-id");
  const requestId = header && header.trim().length > 0 ? header.trim() : randomUUID();
  req.id = requestId;
  res.setHeader("x-request-id", requestId);
  next();
};
