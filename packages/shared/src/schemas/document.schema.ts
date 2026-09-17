import { z } from "zod";
import { DOCUMENT_TYPES } from "../enums.js";

export const CreateDocumentRequest = z.object({
  organizationId: z.string().uuid(),
  auctionId: z.string().uuid().optional(),
  docType: z.enum(DOCUMENT_TYPES),
  fileName: z.string().min(1).max(200),
  mimeType: z.string().min(1).max(80),
});
export type CreateDocumentRequest = z.infer<typeof CreateDocumentRequest>;

export const Document = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  auctionId: z.string().uuid().nullable(),
  docType: z.enum(DOCUMENT_TYPES),
  fileName: z.string(),
  fileUrl: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().int().nonnegative().optional(),
  checksum: z.string().length(64).optional(),
  summary: z.string().optional(),
  uploadedBy: z.string().uuid(),
  createdAt: z.string().datetime(),
});
export type Document = z.infer<typeof Document>;