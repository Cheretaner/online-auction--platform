import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { AppError, HttpStatus } from "../errors/index.js";
import { logger } from "../utils/logger.js";

export const errorMiddleware: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      error: {
        message: error.message,
        code: error.code,
        details: error.details,
      },
    });
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

  logger.error({ err: error }, "Unhandled error");
  res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
    error: { message: "Internal server error" },
  });
};
