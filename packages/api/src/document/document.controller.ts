import type { RequestHandler } from "express";
import { DOCUMENT_TYPES } from "@auction/shared";
import type { AuctionScopedQuery, DocumentType } from "@auction/shared";
import { AppError, HttpStatus } from "../shared/errors/index.js";
import { getAuth, routeParam } from "../shared/types/request.js";
import { findAuctionOwner } from "../shared/authz/auction-access.js";
import * as service from "./document.service.js";

const OFFICER_ROLES = ["auction_officer", "org_admin", "compliance_officer", "super_admin"];

export const upload: RequestHandler = async (req, res) => {
  const auth = getAuth(req);
  const file = req.file;
  if (!file) {
    throw AppError.badRequest("No file uploaded. Send multipart/form-data with a 'file' field.");
  }

  // Multipart fields arrive as strings, so this body cannot go through a
  // normal Zod body validator — it is checked here instead.
  const { auctionId, docType, isPrivate } = req.body as {
    auctionId?: string;
    docType?: string;
    isPrivate?: string;
  };

  if (!docType || !(DOCUMENT_TYPES as readonly string[]).includes(docType)) {
    throw AppError.badRequest(`docType must be one of: ${DOCUMENT_TYPES.join(", ")}`);
  }

  if (docType === "identity_document" && (!auth.roles.includes("bidder") || auctionId)) {
    throw AppError.badRequest("Identity evidence must be uploaded by a bidder without an auction association");
  }

  // Default to private: a document is only public once someone says so.
  let keepPrivate = isPrivate !== "false";
  if (docType === "identity_document") keepPrivate = true;
  if (auctionId) {
    const owner = await findAuctionOwner(auctionId);
    if (!owner) throw AppError.notFound("Auction not found");
    // Only the auction's own organization may add to its public document
    // pack. Anyone else (a bidder attaching a deposit proof or dispute
    // evidence) can attach a document, but it stays private: visible to the
    // uploader and to that organization's officers.
    const isStaff =
      auth.roles.includes("super_admin") ||
      (auth.roles.some((role) => OFFICER_ROLES.includes(role)) && auth.organizationId === owner.orgId);
    if (!isStaff) keepPrivate = true;
  }

  const document = await service.uploadDocument({
    auctionId: auctionId || undefined,
    uploadedBy: auth.userId,
    roles: auth.roles,
    documentType: docType as DocumentType,
    fileName: file.originalname,
    mimeType: file.mimetype,
    data: file.buffer,
    isPrivate: keepPrivate,
  });

  res.status(HttpStatus.CREATED).json(document);
};

export const getById: RequestHandler = async (req, res) => {
  const auth = getAuth(req);
  const doc = await service.getDocument(routeParam(req.params.id));
  if (!doc) throw AppError.notFound("Document not found");

  if (!(await service.canReadDocument(doc, auth))) {
    throw new AppError("Forbidden", HttpStatus.FORBIDDEN, "FORBIDDEN");
  }

  res.json(doc);
};

export const download: RequestHandler = async (req, res) => {
  const auth = getAuth(req);
  const result = await service.readDocument(routeParam(req.params.id), auth);

  res.setHeader("Content-Type", result.document.mimeType);
  res.setHeader("Content-Length", String(result.document.fileSizeBytes));
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${encodeURIComponent(result.document.fileName)}"`,
  );
  res.send(result.data);
};

export const listByAuction: RequestHandler = async (req, res) => {
  const auth = getAuth(req);
  const { auctionId } = req.query as unknown as AuctionScopedQuery;

  // Officer status alone is not enough to see another organization's
  // private document pack; it must be an officer OF THIS auction's org.
  const owner = await findAuctionOwner(auctionId);
  if (!owner) throw AppError.notFound("Auction not found");

  const isOfficer =
    auth.roles.some((role) => OFFICER_ROLES.includes(role)) &&
    (auth.roles.includes("super_admin") || auth.organizationId === owner.orgId);

  const docs = await service.listByAuction(auctionId);

  // Bidders see only the published pack, not internal inspection notes.
  res.json({ items: isOfficer ? docs : docs.filter((doc) => !doc.isPrivate) });
};

export const listMine: RequestHandler = async (req, res) => {
  const auth = getAuth(req);
  res.json({ items: await service.listByUploader(auth.userId) });
};
