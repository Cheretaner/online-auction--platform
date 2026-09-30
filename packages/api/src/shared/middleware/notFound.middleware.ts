import type { RequestHandler } from "express";
import { AppError, HttpStatus } from "../errors/index.js";

export const notFoundMiddleware: RequestHandler = (req, _res, next) => {
  next(new AppError(`Route not found: ${req.method} ${req.path}`, HttpStatus.NOT_FOUND));
};
