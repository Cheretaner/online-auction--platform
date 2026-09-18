import { query } from "../infrastructure/database/query.js";
import type { DocumentRecord } from "./document.types.js";

interface DbDocument {
  id: string;
  organization_id: string;
  auction_id: string | null;
  storage_key: string;
  filename: string;
  content_type: string;
  uploaded_by: string;
  created_at: Date;
}

function mapDocument(row: DbDocument): DocumentRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    auctionId: row.auction_id ?? undefined,
    storageKey: row.storage_key,
    filename: row.filename,
    contentType: row.content_type,
    uploadedBy: row.uploaded_by,
    createdAt: row.created_at.toISOString(),
  };
}

export async function createDocument(input: Omit<DocumentRecord, "id" | "createdAt">): Promise<DocumentRecord> {
  const result = await query<DbDocument>(
    `INSERT INTO documents (organization_id, auction_id, storage_key, filename, content_type, uploaded_by)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [
      input.organizationId,
      input.auctionId ?? null,
      input.storageKey,
      input.filename,
      input.contentType,
      input.uploadedBy,
    ],
  );
  return mapDocument(result.rows[0]);
}
