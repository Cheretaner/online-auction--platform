import type { DocumentType } from "@auction/shared";
import { query, queryOne, queryAll } from "../infrastructure/database/query.js";
import type { DocumentRecord } from "./document.types.js";

interface DbDocument {
  id: string;
  auction_id: string | null;
  uploaded_by: string;
  document_type: DocumentType;
  file_name: string;
  storage_path: string;
  mime_type: string;
  file_size_bytes: string; // BIGINT comes as string from pg
  checksum_sha256: string;
  is_private: boolean;
  summary: string | null;
  created_at: Date;
  updated_at: Date;
}

function mapDocument(row: DbDocument): DocumentRecord {
  return {
    id: row.id,
    auctionId: row.auction_id,
    uploadedBy: row.uploaded_by,
    documentType: row.document_type,
    fileName: row.file_name,
    storagePath: row.storage_path,
    mimeType: row.mime_type,
    fileSizeBytes: Number(row.file_size_bytes),
    checksumSha256: row.checksum_sha256,
    isPrivate: row.is_private,
    summary: row.summary,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function createDocument(input: {
  auctionId?: string;
  uploadedBy: string;
  documentType: DocumentType;
  fileName: string;
  storagePath: string;
  mimeType: string;
  fileSizeBytes: number;
  checksumSha256: string;
  isPrivate: boolean;
}): Promise<DocumentRecord> {
  const result = await query<DbDocument>(
    `INSERT INTO documents (auction_id, uploaded_by, document_type, file_name, storage_path, mime_type, file_size_bytes, checksum_sha256, is_private)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
    [
      input.auctionId ?? null,
      input.uploadedBy,
      input.documentType,
      input.fileName,
      input.storagePath,
      input.mimeType,
      input.fileSizeBytes,
      input.checksumSha256,
      input.isPrivate,
    ],
  );
  return mapDocument(result.rows[0]);
}

export async function findById(id: string): Promise<DocumentRecord | null> {
  const row = await queryOne<DbDocument>("SELECT * FROM documents WHERE id = $1", [id]);
  return row ? mapDocument(row) : null;
}

export async function findByAuctionId(auctionId: string): Promise<DocumentRecord[]> {
  const rows = await queryAll<DbDocument>("SELECT * FROM documents WHERE auction_id = $1 ORDER BY created_at DESC", [auctionId]);
  return rows.map(mapDocument);
}

export async function findByUploader(uploadedBy: string): Promise<DocumentRecord[]> {
  const rows = await queryAll<DbDocument>("SELECT * FROM documents WHERE uploaded_by = $1 ORDER BY created_at DESC", [uploadedBy]);
  return rows.map(mapDocument);
}
