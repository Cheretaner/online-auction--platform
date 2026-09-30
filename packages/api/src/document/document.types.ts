import type { DocumentType } from "@auction/shared";

export interface DocumentRecord {
  id: string;
  auctionId: string | null;
  uploadedBy: string;
  documentType: DocumentType;
  fileName: string;
  storagePath: string;
  mimeType: string;
  fileSizeBytes: number;
  checksumSha256: string;
  isPrivate: boolean;
  summary: string | null;
  createdAt: string;
  updatedAt: string;
}
