import { createHash, randomUUID } from "node:crypto";
import type { DocumentType, Role } from "@auction/shared";
import { storageAdapter } from "../infrastructure/storage/storage.adapter.js";
import { withTransaction } from "../infrastructure/database/tx.js";
import { AppError, HttpStatus } from "../shared/errors/index.js";
import * as audit from "../audit/audit.service.js";
import { findAuctionOwner } from "../shared/authz/auction-access.js";
import * as repo from "./document.repository.js";
import type { DocumentRecord } from "./document.types.js";
import { validateUploadedFile } from "./file-validation.js";
import { logger } from "../shared/utils/logger.js";
import { hashSensitive } from "../shared/security/sensitive-data.js";
import * as ocrRepo from "./document-ocr.repository.js";
import { extractDocumentText } from "./document-ocr.service.js";

const OFFICER_ROLES = ["auction_officer", "org_admin", "compliance_officer", "super_admin"];
const OCR_TYPES = new Set(["specification", "inspection_report", "terms", "other"]);

/** Strips any directory component so a crafted filename cannot escape the store. */
function safeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "upload";
  return base.replace(/[^\w.\- ]+/g, "_").slice(0, 200) || "upload";
}

export async function uploadDocument(input: {
  auctionId?: string;
  uploadedBy: string;
  roles: Role[];
  documentType: DocumentType;
  fileName: string;
  mimeType: string;
  data: Buffer;
  isPrivate?: boolean;
}): Promise<DocumentRecord> {
  if (input.data.byteLength === 0) {
    // documents_file_size_positive would reject this at the database level
    // anyway, but a clear 400 beats a constraint violation.
    throw AppError.badRequest("Uploaded file is empty");
  }

  const validatedFile = await validateUploadedFile(input.data, input.mimeType, input.documentType);

  const sanitizedName = safeFileName(input.fileName);
  const fileName = `${sanitizedName.replace(/\.[^.]+$/, "")}.${validatedFile.extension}`;
  const checksumSha256 = createHash("sha256").update(input.data).digest("hex");
  const storagePath = `uploads/${randomUUID()}/${fileName}`;

  await storageAdapter.put(storagePath, input.data, validatedFile.mimeType);

  try {
    return await withTransaction(
      async () => {
        const document = await repo.createDocument({
          auctionId: input.auctionId,
          uploadedBy: input.uploadedBy,
          documentType: input.documentType,
          fileName,
          storagePath,
          mimeType: validatedFile.mimeType,
          fileSizeBytes: input.data.byteLength,
          checksumSha256,
          isPrivate: input.isPrivate ?? true,
        });

        // The checksum goes into the ledger so a published document can
        // later be proved to be the one that was reviewed.
        await audit.appendAuditEvent({
          auctionId: input.auctionId ?? null,
          actorId: input.uploadedBy,
          actorRole: audit.actorRoleOf(input.roles),
          entityType: "document",
          entityId: document.id,
          action: "document.uploaded",
          payload: {
            fileName: document.fileName,
            documentType: document.documentType,
            checksumSha256: document.checksumSha256,
            sizeBytes: document.fileSizeBytes,
          },
        });

        return document;
      },
      { userId: input.uploadedBy },
    );
  } catch (error) {
    // Do not leave an orphaned blob behind if the row could not be written.
    await storageAdapter.delete(storagePath).catch(() => undefined);
    throw error;
  }
}

export async function getDocument(id: string): Promise<DocumentRecord | null> {
  return repo.findById(id);
}

/**
 * Reads the bytes back, verifying the stored checksum first. A mismatch
 * means the blob was altered outside the application, which is exactly the
 * kind of tampering the platform is meant to surface rather than serve.
 */
export interface DocumentViewer {
  userId: string;
  roles: Role[];
  organizationId?: string;
}

/**
 * Who may open a private document (deposit proofs, inspection notes):
 * the uploader, a super admin, or an officer of the organization that owns
 * the document's auction. Holding an officer role in some other
 * organization is not enough. A private document with no auction (e.g. an
 * identity document) is limited to the uploader, super admins and
 * compliance officers.
 */
export async function canReadDocument(document: DocumentRecord, viewer: DocumentViewer): Promise<boolean> {
  if (!document.isPrivate) return true;
  if (document.uploadedBy === viewer.userId) return true;
  if (viewer.roles.includes("super_admin")) return true;
  if (!document.auctionId) return viewer.roles.includes("compliance_officer");

  const isOfficer = viewer.roles.some((role) => OFFICER_ROLES.includes(role));
  if (!isOfficer || !viewer.organizationId) return false;
  const owner = await findAuctionOwner(document.auctionId);
  return owner?.orgId === viewer.organizationId;
}

export async function readDocument(
  id: string,
  viewer: DocumentViewer,
): Promise<{ document: DocumentRecord; data: Buffer }> {
  const document = await repo.findById(id);
  if (!document) throw AppError.notFound("Document not found");

  if (!(await canReadDocument(document, viewer))) {
    throw new AppError("Forbidden", HttpStatus.FORBIDDEN, "FORBIDDEN");
  }

  const stored = await storageAdapter.get(document.storagePath);
  if (!stored) throw AppError.notFound("Document content is no longer available");

  const checksum = createHash("sha256").update(stored.data).digest("hex");
  if (checksum !== document.checksumSha256) {
    throw new AppError(
      "Stored document failed its integrity check",
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }

  if (document.isPrivate) {
    await audit.appendAuditEvent({
      auctionId: document.auctionId,
      actorId: viewer.userId,
      actorRole: audit.actorRoleOf(viewer.roles),
      entityType: "document",
      entityId: document.id,
      action: "document.private_accessed",
      payload: { checksumSha256: document.checksumSha256 },
    });
  }

  return { document, data: stored.data };
}

export async function listByAuction(auctionId: string): Promise<DocumentRecord[]> {
  return repo.findByAuctionId(auctionId);
}

export async function listByUploader(userId: string): Promise<DocumentRecord[]> {
  return repo.findByUploader(userId);
}

async function assertOcrOfficer(document: DocumentRecord, viewer: DocumentViewer): Promise<void> {
  if (!OCR_TYPES.has(document.documentType)) {
    throw AppError.badRequest("OCR is available for auction terms, specifications, inspection reports, and other auction documents");
  }
  if (viewer.roles.includes("super_admin")) return;
  if (!viewer.organizationId || !viewer.roles.some((role) => OFFICER_ROLES.includes(role)) || !document.auctionId) {
    throw new AppError("Forbidden", HttpStatus.FORBIDDEN, "FORBIDDEN");
  }
  const owner = await findAuctionOwner(document.auctionId);
  if (owner?.orgId !== viewer.organizationId) {
    throw new AppError("Forbidden", HttpStatus.FORBIDDEN, "FORBIDDEN");
  }
}

async function runOcr(document: DocumentRecord, viewer: DocumentViewer): Promise<void> {
  try {
    const stored = await storageAdapter.get(document.storagePath);
    if (!stored) throw AppError.notFound("Document content is no longer available");
    const checksum = createHash("sha256").update(stored.data).digest("hex");
    if (checksum !== document.checksumSha256) {
      throw new AppError("Stored document failed its integrity check", HttpStatus.INTERNAL_SERVER_ERROR);
    }
    const result = await extractDocumentText(stored.data, document.mimeType);
    await ocrRepo.complete({
      documentId: document.id,
      text: result.text,
      method: result.method,
      confidence: result.confidence,
      referenceCandidates: result.referenceCandidates,
    });
    await audit.appendAuditEvent({
      auctionId: document.auctionId,
      actorId: viewer.userId,
      actorRole: audit.actorRoleOf(viewer.roles),
      entityType: "document",
      entityId: document.id,
      action: "document.ocr_completed",
      payload: {
        checksumSha256: document.checksumSha256,
        extractionMethod: result.method,
        confidence: result.confidence,
        extractedCharacters: result.text.length,
        referenceCandidateCount: result.referenceCandidates.length,
      },
    });
  } catch (error) {
    logger.warn({ documentId: document.id, err: error }, "Document OCR processing failed");
    const message = error instanceof AppError
      ? error.message
      : "OCR processing failed. Check server language-data access and retry.";
    await ocrRepo.fail(document.id, message);
  }
}

export async function startDocumentOcr(id: string, viewer: DocumentViewer): Promise<ocrRepo.DocumentOcrResult> {
  const document = await repo.findById(id);
  if (!document) throw AppError.notFound("Document not found");
  await assertOcrOfficer(document, viewer);

  const existing = await ocrRepo.find(id);
  if (existing?.status === "completed" || existing?.status === "processing") return existing;
  const started = await ocrRepo.begin(id);
  if (!started) return (await ocrRepo.find(id))!;

  try {
    await audit.appendAuditEvent({
      auctionId: document.auctionId,
      actorId: viewer.userId,
      actorRole: audit.actorRoleOf(viewer.roles),
      entityType: "document",
      entityId: document.id,
      action: "document.ocr_started",
      payload: { checksumSha256: document.checksumSha256 },
    });
  } catch (error) {
    await ocrRepo.fail(document.id, "OCR could not start because its audit event could not be recorded");
    throw error;
  }

  // Respond quickly; extraction runs against the checksum-verified stored original.
  setImmediate(() => void runOcr(document, viewer).catch((error: unknown) => {
    logger.error({ documentId: document.id, err: error }, "Could not persist OCR processing result");
  }));
  return (await ocrRepo.find(id))!;
}

export async function getDocumentOcr(id: string, viewer: DocumentViewer): Promise<ocrRepo.DocumentOcrResult | null> {
  const document = await repo.findById(id);
  if (!document) throw AppError.notFound("Document not found");
  await assertOcrOfficer(document, viewer);
  return ocrRepo.find(id);
}

export async function reviewDocumentOcr(
  id: string,
  viewer: DocumentViewer,
  reviewedText: string,
): Promise<ocrRepo.DocumentOcrResult> {
  const document = await repo.findById(id);
  if (!document) throw AppError.notFound("Document not found");
  await assertOcrOfficer(document, viewer);
  const result = await ocrRepo.review(id, viewer.userId, reviewedText);
  if (!result) throw AppError.conflict("Run OCR before reviewing extracted text");
  await audit.appendAuditEvent({
    auctionId: document.auctionId,
    actorId: viewer.userId,
    actorRole: audit.actorRoleOf(viewer.roles),
    entityType: "document",
    entityId: document.id,
    action: "document.ocr_reviewed",
    payload: {
      checksumSha256: document.checksumSha256,
      extractedCharacters: result.extractedText?.length ?? 0,
      reviewedCharacters: result.reviewedText?.length ?? 0,
    },
  });
  return result;
}

export async function searchReviewedOcr(
  auctionId: string,
  searchText: string,
  viewer: DocumentViewer,
): Promise<ocrRepo.DocumentOcrSearchHit[]> {
  if (!viewer.roles.includes("super_admin")) {
    const owner = await findAuctionOwner(auctionId);
    const isOfficer = viewer.roles.some((role) => OFFICER_ROLES.includes(role));
    if (!owner || !isOfficer || owner.orgId !== viewer.organizationId) {
      throw new AppError("Forbidden", HttpStatus.FORBIDDEN, "FORBIDDEN");
    }
  }
  return ocrRepo.searchReviewed(auctionId, searchText);
}

export async function reviewDepositReferenceSuggestion(
  documentId: string,
  candidate: string,
  viewer: DocumentViewer,
): Promise<{ candidate: string; matchesSubmittedReference: boolean }> {
  const document = await repo.findById(documentId);
  if (!document) throw AppError.notFound("Document not found");
  await assertOcrOfficer(document, viewer);
  const extraction = await ocrRepo.find(documentId);
  if (extraction?.status !== "completed" || !extraction.referenceCandidates.includes(candidate)) {
    throw AppError.badRequest("The selected reference is not an OCR suggestion for this document");
  }
  const deposit = await ocrRepo.findDepositReference(documentId);
  if (!deposit) throw AppError.notFound("No deposit is linked to this document");

  const matchesSubmittedReference = hashSensitive(candidate) === deposit.referenceHash;
  await audit.appendAuditEvent({
    auctionId: document.auctionId,
    actorId: viewer.userId,
    actorRole: audit.actorRoleOf(viewer.roles),
    entityType: "deposit",
    entityId: deposit.depositId,
    action: "deposit.reference_ocr_checked",
    payload: {
      documentId,
      documentChecksumSha256: document.checksumSha256,
      candidateFingerprint: hashSensitive(candidate),
      matchesSubmittedReference,
    },
  });
  return { candidate, matchesSubmittedReference };
}
