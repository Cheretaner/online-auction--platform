import type { RequestHandler } from "express";
import { env } from "../config/env.js";
import { AppError, HttpStatus } from "../shared/errors/index.js";

export const requireDocumentUploads: RequestHandler = (_req, _res, next) => {
  if (!env.DOCUMENT_UPLOADS_ENABLED) {
    next(
      new AppError(
        "Document uploads and document-based identity verification are temporarily unavailable while secure storage and malware scanning are configured.",
        HttpStatus.SERVICE_UNAVAILABLE,
      ),
    );
    return;
  }
  next();
};
