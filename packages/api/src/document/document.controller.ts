import type { RequestHandler } from "express";
import { z } from "zod";
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
  const { auctionId, docType, isPrivate, requiresPayment } = req.body as {
    auctionId?: string;
    docType?: string;
    isPrivate?: string;
    requiresPayment?: string;
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
  if (requiresPayment === "true" && !auctionId) {
    throw AppError.badRequest("Paid documents must belong to an auction");
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
    requiresPayment: requiresPayment === "true",
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

export const deleteById: RequestHandler = async (req, res) => {
  const auth = getAuth(req);
  await service.deleteDocument(routeParam(req.params.id), auth);
  res.status(HttpStatus.NO_CONTENT).send();
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

export const getOcr: RequestHandler = async (req, res) => {
  const result = await service.getDocumentOcr(routeParam(req.params.id), getAuth(req));
  res.json({ item: result });
};

export const startOcr: RequestHandler = async (req, res) => {
  const result = await service.startDocumentOcr(routeParam(req.params.id), getAuth(req));
  res.status(202).json({ item: result });
};

export const reviewOcr: RequestHandler = async (req, res) => {
  const body = z.object({ reviewedText: z.string().trim().min(1).max(500_000) }).parse(req.body);
  const result = await service.reviewDocumentOcr(routeParam(req.params.id), getAuth(req), body.reviewedText);
  res.json({ item: result });
};

export const searchReviewedOcr: RequestHandler = async (req, res) => {
  const query = z.object({
    auctionId: z.string().uuid(),
    q: z.string().trim().min(2).max(120),
  }).parse(req.query);
  const items = await service.searchReviewedOcr(query.auctionId, query.q, getAuth(req));
  res.json({ items });
};

export const reviewOcrReference: RequestHandler = async (req, res) => {
  const body = z.object({ candidate: z.string().trim().min(3).max(40) }).parse(req.body);
  const result = await service.reviewDepositReferenceSuggestion(
    routeParam(req.params.id),
    body.candidate,
    getAuth(req),
  );
  res.json({ item: result });
};
