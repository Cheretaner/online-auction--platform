import { z } from "zod";
import { DOCUMENT_TYPES } from "../enums.js";

export const CreateDocumentRequest = z.object({
  auctionId: z.string().uuid().optional(),   // matches nullable FK
  docType: z.enum(DOCUMENT_TYPES),
  fileName: z.string().min(1).max(200),
  mimeType: z.string().min(1).max(80),
});
export type CreateDocumentRequest = z.infer<typeof CreateDocumentRequest>;

export const Document = z.object({
  id: z.string().uuid(),
  auctionId: z.string().uuid().nullable(),
  uploadedBy: z.string().uuid(),
  docType: z.enum(DOCUMENT_TYPES),
  fileName: z.string(),
  storagePath: z.string(),          
  mimeType: z.string(),
  sizeBytes: z.number().int().positive(), 
  checksum: z.string().length(64),       
  isPrivate: z.boolean(),
  createdAt: z.string().datetime(),
});
export type Document = z.infer<typeof Document>;