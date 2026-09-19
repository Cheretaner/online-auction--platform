import type { RequestHandler } from "express";
import type { DocumentType } from "@auction/shared";
import type { AuthenticatedRequest } from "../shared/types/request.js";
import { routeParam } from "../shared/types/request.js";
import { AppError, HttpStatus } from "../shared/errors/index.js";
import * as service from "./document.service.js";

export const upload: RequestHandler = async (req, res, next) => {
  try {
    const auth = (req as AuthenticatedRequest).auth!;
    const file = req.file;
    if (!file) {
      throw new AppError("No file uploaded", HttpStatus.BAD_REQUEST);
    }

    const { auctionId, docType, isPrivate } = req.body as {
      auctionId?: string;
      docType: DocumentType;
      isPrivate?: string;
    };

    const document = await service.uploadDocument({
      auctionId,
      uploadedBy: auth.userId,
      documentType: docType,
      fileName: file.originalname,
      mimeType: file.mimetype,
      data: file.buffer,
      isPrivate: isPrivate === "true",
    });

    res.status(201).json(document);
  } catch (error) {
    next(error);
  }
};

export const getById: RequestHandler = async (req, res, next) => {
  try {
    const doc = await service.getDocument(routeParam(req.params.id));
    if (!doc) throw AppError.notFound("Document not found");
    res.json(doc);
  } catch (error) {
    next(error);
  }
};

export const listByAuction: RequestHandler = async (req, res, next) => {
  try {
    const auctionId = req.query.auctionId as string;
    if (!auctionId) throw AppError.badRequest("auctionId query parameter is required");
    const docs = await service.listByAuction(auctionId);
    res.json({ items: docs });
  } catch (error) {
    next(error);
  }
};
