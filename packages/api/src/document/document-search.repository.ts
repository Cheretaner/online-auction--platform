import { queryAll, queryOne } from "../infrastructure/database/query.js";
import type { Queryable } from "../infrastructure/database/query.js";
import type { Role } from "@auction/shared";

export interface DocumentSearchResult {
  id: string;
  filename: string;
  documentType: string;
  auctionId: string | null;
  uploadedBy: string;
  uploadedAt: Date;
  extractedText: string;
  ocrStatus: string;
  headline: string;
  rank: number;
}

export interface DocumentSearchFilters {
  query: string;
  auctionId?: string;
  documentType?: string;
  uploadedBy?: string;
  viewer?: {
    userId: string;
    roles: Role[];
    organizationId?: string;
  };
  language?: 'english' | 'amharic' | 'both';
  limit: number;
  offset: number;
}

interface DbSearchResult {
  id: string;
  filename: string;
  document_type: string;
  auction_id: string | null;
  uploaded_by: string;
  uploaded_at: Date;
  extracted_text: string;
  ocr_status: string;
  headline: string;
  rank: number;
}

function mapSearchResult(row: DbSearchResult): DocumentSearchResult {
  return {
    id: row.id,
    filename: row.filename,
    documentType: row.document_type,
    auctionId: row.auction_id,
    uploadedBy: row.uploaded_by,
    uploadedAt: row.uploaded_at,
    extractedText: row.extracted_text,
    ocrStatus: row.ocr_status,
    headline: row.headline,
    rank: row.rank,
  };
}

/**
 * Full-text search across OCR extracted text in documents
 * Uses PostgreSQL ts_vector and ts_query for ranked results
 */
export async function searchDocuments(
  filters: DocumentSearchFilters,
  client?: Queryable,
): Promise<{ items: DocumentSearchResult[]; total: number }> {
  const where: string[] = ["ocr_status = 'completed'", "extracted_text IS NOT NULL"];
  const values: unknown[] = [];
  const param = (value: unknown) => {
    values.push(value);
    return `$${values.length}`;
  };

  // Build search query based on language
  const searchQuery = filters.query.replace(/[\\%_]/g, (c) => `\\${c}`);
  const tsQuery = searchQuery
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.replace(/[^a-zA-Z0-9\u1200-\u137F]/g, ''))
    .filter(Boolean)
    .join(' & ');

  if (!tsQuery) {
    return { items: [], total: 0 };
  }

  const queryParam = param(tsQuery);
  
  // Choose search configuration based on language preference
  let searchCondition: string;
  if (filters.language === 'amharic') {
    searchCondition = `to_tsvector('simple', extracted_text) @@ to_tsquery('simple', ${queryParam})`;
  } else if (filters.language === 'both') {
    searchCondition = `(to_tsvector('english', extracted_text) @@ to_tsquery('english', ${queryParam}) 
                        OR to_tsvector('simple', extracted_text) @@ to_tsquery('simple', ${queryParam}))`;
  } else {
    // Default to English
    searchCondition = `to_tsvector('english', extracted_text) @@ to_tsquery('english', ${queryParam})`;
  }

  where.push(searchCondition);

  // Additional filters
  if (filters.auctionId) {
    where.push(`auction_id = ${param(filters.auctionId)}`);
  }

  if (filters.documentType) {
    where.push(`document_type = ${param(filters.documentType)}`);
  }

  if (filters.uploadedBy) {
    where.push(`uploaded_by = ${param(filters.uploadedBy)}`);
  }

  if (filters.viewer) {
    const userId = param(filters.viewer.userId);
    const organizationId = param(filters.viewer.organizationId ?? null);
    const isSuperAdmin = param(filters.viewer.roles.includes("super_admin"));
    const isCompliance = param(filters.viewer.roles.includes("compliance_officer"));
    const isOfficer = param(filters.viewer.roles.some((role) =>
      ["org_admin", "auction_officer", "compliance_officer"].includes(role),
    ));
    where.push(`(
      (requires_payment = FALSE AND is_private = FALSE)
      OR uploaded_by = ${userId}
      OR ${isSuperAdmin}::BOOLEAN
      OR (${isCompliance}::BOOLEAN AND auction_id IS NULL)
      OR (
        ${isOfficer}::BOOLEAN AND auction_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM auctions a
           WHERE a.id = searchable_documents.auction_id
             AND a.org_id = ${organizationId}
        )
      )
      OR (
        requires_payment = TRUE AND EXISTS (
          SELECT 1 FROM auction_document_access ada
           WHERE ada.auction_id = searchable_documents.auction_id
             AND ada.bidder_id = ${userId}
             AND ada.status = 'succeeded'
        )
      )
    )`);
  } else {
    where.push("requires_payment = FALSE");
  }

  const whereSql = where.join(" AND ");
  const searchableDocuments = `
    WITH searchable_documents AS (
      SELECT d.id, d.file_name AS filename, d.document_type, d.auction_id, d.uploaded_by,
             d.created_at AS uploaded_at,
             COALESCE(ocr.extracted_text, d.extracted_text) AS extracted_text,
             COALESCE(ocr.status, d.ocr_status) AS ocr_status,
             d.is_private,
             d.requires_payment
        FROM documents d
        LEFT JOIN document_ocr_results ocr ON ocr.document_id = d.id
    )
  `;

  // Count total matches
  const countRow = await queryOne<{ total: string }>(
    `${searchableDocuments}
     SELECT count(*)::text AS total FROM searchable_documents WHERE ${whereSql}`,
    values,
    client,
  );

  // Get ranked results with headline (snippet showing matched text)
  const limit = param(filters.limit);
  const offset = param(filters.offset);
  
  const rankFunction = filters.language === 'amharic' 
    ? `ts_rank(to_tsvector('simple', extracted_text), to_tsquery('simple', ${queryParam}))`
    : filters.language === 'both'
    ? `GREATEST(
        ts_rank(to_tsvector('english', extracted_text), to_tsquery('english', ${queryParam})),
        ts_rank(to_tsvector('simple', extracted_text), to_tsquery('simple', ${queryParam}))
      )`
    : `ts_rank(to_tsvector('english', extracted_text), to_tsquery('english', ${queryParam}))`;

  const headlineFunction = filters.language === 'amharic'
    ? `ts_headline('simple', extracted_text, to_tsquery('simple', ${queryParam}), 'MaxWords=50, MinWords=25, ShortWord=3')`
    : `ts_headline('english', extracted_text, to_tsquery('english', ${queryParam}), 'MaxWords=50, MinWords=25, ShortWord=3')`;

  const rows = await queryAll<DbSearchResult>(
    `${searchableDocuments}
     SELECT
      id,
      filename,
      document_type,
      auction_id,
      uploaded_by,
      uploaded_at,
      extracted_text,
      ocr_status,
      ${headlineFunction} as headline,
      ${rankFunction} as rank
    FROM searchable_documents
    WHERE ${whereSql}
    ORDER BY rank DESC, uploaded_at DESC
    LIMIT ${limit} OFFSET ${offset}`,
    values,
    client,
  );

  return {
    items: rows.map(mapSearchResult),
    total: Number(countRow?.total ?? 0),
  };
}

/**
 * Search documents within a specific auction
 */
export async function searchAuctionDocuments(
  auctionId: string,
  query: string,
  language: 'english' | 'amharic' | 'both' = 'english',
  client?: Queryable,
): Promise<DocumentSearchResult[]> {
  const result = await searchDocuments(
    {
      query,
      auctionId,
      language,
      limit: 50,
      offset: 0,
    },
    client,
  );
  return result.items;
}

/**
 * Get document text snippets for AI assistant context
 * Returns top N most relevant documents for a query
 */
export async function getDocumentSnippetsForAssistant(
  query: string,
  auctionId?: string,
  maxResults: number = 5,
  client?: Queryable,
): Promise<Array<{ documentId: string; filename: string; snippet: string }>> {
  const filters: DocumentSearchFilters = {
    query,
    limit: maxResults,
    offset: 0,
    language: 'both',
  };

  if (auctionId) {
    filters.auctionId = auctionId;
  }

  const result = await searchDocuments(filters, client);

  return result.items.map((doc) => ({
    documentId: doc.id,
    filename: doc.filename,
    snippet: doc.headline,
  }));
}
