import type { RequestHandler } from "express";
import type { AuthenticatedRequest } from "../shared/types/request.js";
import { AppError, HttpStatus } from "../shared/errors/index.js";
import * as service from "./document.service.js";

export const upload: RequestHandler = async (req, res, next) => {
  try {
    const auth = (req as AuthenticatedRequest).auth!;
    const { organizationId, auctionId, filename, contentType, dataBase64 } = req.body as {
      organizationId: string;
      auctionId?: string;
      filename: string;
      contentType: string;
      dataBase64: string;
    };

    if (!dataBase64) {
      throw new AppError("Missing document payload", HttpStatus.BAD_REQUEST);
    }

    const document = await service.uploadDocument({
      organizationId,
      auctionId,
      filename,
      contentType,
      data: Buffer.from(dataBase64, "base64"),
      uploadedBy: auth.userId,
    });

    res.status(201).json(document);
  } catch (error) {
    next(error);
  }
};
