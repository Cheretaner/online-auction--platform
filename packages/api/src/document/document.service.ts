import { createHash, randomUUID } from "node:crypto";
import type { DocumentType } from "@auction/shared";
import { storageAdapter } from "../infrastructure/storage/storage.adapter.js";
import { withTransaction } from "../infrastructure/database/tx.js";
import * as repo from "./document.repository.js";
import type { DocumentRecord } from "./document.types.js";

export async function uploadDocument(input: {
  auctionId?: string;
  uploadedBy: string;
  documentType: DocumentType;
  fileName: string;
  mimeType: string;
  data: Buffer;
  isPrivate?: boolean;
}): Promise<DocumentRecord> {
  const checksumSha256 = createHash("sha256").update(input.data).digest("hex");
  const fileSizeBytes = input.data.byteLength;
  const storagePath = `uploads/${randomUUID()}/${input.fileName}`;

  await storageAdapter.put(storagePath, input.data, input.mimeType);

  return withTransaction(async () => {
    return repo.createDocument({
      auctionId: input.auctionId,
      uploadedBy: input.uploadedBy,
      documentType: input.documentType,
      fileName: input.fileName,
      storagePath,
      mimeType: input.mimeType,
      fileSizeBytes,
      checksumSha256,
      isPrivate: input.isPrivate ?? false,
    });
  }, { userId: input.uploadedBy });
}

export async function getDocument(id: string): Promise<DocumentRecord | null> {
  return repo.findById(id);
}

export async function listByAuction(auctionId: string): Promise<DocumentRecord[]> {
  return repo.findByAuctionId(auctionId);
}
