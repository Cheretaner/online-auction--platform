import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { AppError, HttpStatus } from "../errors/index.js";
import { logger } from "../utils/logger.js";

export const errorMiddleware: ErrorRequestHandler = (error, req, res, _next) => {
  if (res.headersSent) {
    logger.error({ err: error, requestId: req.id }, "Error after headers sent");
    return;
  }

  if (error instanceof AppError) {
    res.status(error.statusCode).json({ error: error.toJSON() });
    return;
  }

  if (error instanceof ZodError) {
    res.status(HttpStatus.BAD_REQUEST).json({
      error: {
        message: "Validation failed",
        details: error.flatten(),
      },
    });
    return;
  }

  if (error instanceof SyntaxError && "body" in error) {
    res.status(HttpStatus.BAD_REQUEST).json({
      error: { message: "Invalid JSON payload" },
    });
    return;
  }

  logger.error({ err: error, requestId: req.id }, "Unhandled error");
  res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
    error: { message: "Internal server error" },
  });
};
