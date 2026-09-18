import { randomUUID } from "node:crypto";
import { storageAdapter } from "../infrastructure/storage/storage.adapter.js";
import * as repo from "./document.repository.js";
import type { DocumentRecord } from "./document.types.js";

export async function uploadDocument(input: {
  organizationId: string;
  auctionId?: string;
  filename: string;
  contentType: string;
  data: Buffer;
  uploadedBy: string;
}): Promise<DocumentRecord> {
  const storageKey = `${input.organizationId}/${randomUUID()}-${input.filename}`;
  await storageAdapter.put(storageKey, input.data, input.contentType);

  return repo.createDocument({
    organizationId: input.organizationId,
    auctionId: input.auctionId,
    storageKey,
    filename: input.filename,
    contentType: input.contentType,
    uploadedBy: input.uploadedBy,
  });
}
