import { createHash, randomUUID } from "node:crypto";
import type { DocumentType, Role } from "@auction/shared";
import { storageAdapter } from "../infrastructure/storage/storage.adapter.js";
import { withTransaction } from "../infrastructure/database/tx.js";
import { AppError, HttpStatus } from "../shared/errors/index.js";
import * as audit from "../audit/audit.service.js";
import * as repo from "./document.repository.js";
import type { DocumentRecord } from "./document.types.js";

const OFFICER_ROLES = ["auction_officer", "org_admin", "compliance_officer", "super_admin"];

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

  const fileName = safeFileName(input.fileName);
  const checksumSha256 = createHash("sha256").update(input.data).digest("hex");
  const storagePath = `uploads/${randomUUID()}/${fileName}`;

  await storageAdapter.put(storagePath, input.data, input.mimeType);

  try {
    return await withTransaction(
      async () => {
        const document = await repo.createDocument({
          auctionId: input.auctionId,
          uploadedBy: input.uploadedBy,
          documentType: input.documentType,
          fileName,
          storagePath,
          mimeType: input.mimeType,
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
export async function readDocument(
  id: string,
  viewer: { userId: string; roles: Role[] },
): Promise<{ document: DocumentRecord; data: Buffer }> {
  const document = await repo.findById(id);
  if (!document) throw AppError.notFound("Document not found");

  const isOfficer = viewer.roles.some((role) => OFFICER_ROLES.includes(role));
  if (document.isPrivate && document.uploadedBy !== viewer.userId && !isOfficer) {
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

  return { document, data: stored.data };
}

export async function listByAuction(auctionId: string): Promise<DocumentRecord[]> {
  return repo.findByAuctionId(auctionId);
}

export async function listByUploader(userId: string): Promise<DocumentRecord[]> {
  return repo.findByUploader(userId);
}
