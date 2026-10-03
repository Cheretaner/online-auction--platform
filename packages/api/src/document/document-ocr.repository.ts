import { queryAll, queryOne } from "../infrastructure/database/query.js";

export interface DocumentOcrResult {
  documentId: string;
  status: "processing" | "completed" | "failed";
  extractedText: string | null;
  extractionMethod: "embedded_text" | "tesseract" | null;
  confidence: number | null;
  referenceCandidates: string[];
  errorMessage: string | null;
  reviewedText: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  updatedAt: string;
}

export interface DocumentOcrSearchHit {
  documentId: string;
  fileName: string;
  mimeType: string;
  excerpt: string;
  reviewedAt: string;
}

interface DbDocumentOcrResult extends Omit<DocumentOcrResult, "documentId" | "extractedText" | "extractionMethod" | "referenceCandidates" | "errorMessage" | "reviewedText" | "reviewedBy" | "reviewedAt" | "updatedAt"> {
  document_id: string;
  extracted_text: string | null;
  extraction_method: DocumentOcrResult["extractionMethod"];
  reference_candidates: string[];
  error_message: string | null;
  reviewed_text: string | null;
  reviewed_by: string | null;
  reviewed_at: Date | null;
  updated_at: Date;
}

function mapResult(row: DbDocumentOcrResult): DocumentOcrResult {
  return {
    documentId: row.document_id,
    status: row.status,
    extractedText: row.extracted_text,
    extractionMethod: row.extraction_method,
    confidence: row.confidence === null ? null : Number(row.confidence),
    referenceCandidates: row.reference_candidates ?? [],
    errorMessage: row.error_message,
    reviewedText: row.reviewed_text,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at?.toISOString() ?? null,
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function find(documentId: string): Promise<DocumentOcrResult | null> {
  const row = await queryOne<DbDocumentOcrResult>(
    `SELECT document_id, status, extracted_text, extraction_method, confidence, reference_candidates, error_message,
            reviewed_text, reviewed_by, reviewed_at, updated_at
       FROM document_ocr_results WHERE document_id = $1`,
    [documentId],
  );
  return row ? mapResult(row) : null;
}

export async function begin(documentId: string): Promise<boolean> {
  const result = await queryOne<{ document_id: string }>(
    `INSERT INTO document_ocr_results (document_id, status)
     VALUES ($1, 'processing')
     ON CONFLICT (document_id) DO UPDATE
       SET status = 'processing', extracted_text = NULL, extraction_method = NULL,
           confidence = NULL, reference_candidates = '[]'::JSONB, error_message = NULL, reviewed_text = NULL,
           reviewed_by = NULL, reviewed_at = NULL, updated_at = NOW()
       WHERE document_ocr_results.status = 'failed'
          OR (document_ocr_results.status = 'processing' AND document_ocr_results.updated_at < NOW() - INTERVAL '15 minutes')
     RETURNING document_id`,
    [documentId],
  );
  return Boolean(result);
}

export async function complete(input: {
  documentId: string; text: string; method: "embedded_text" | "tesseract"; confidence: number; referenceCandidates: string[];
}): Promise<void> {
  await queryOne(
    `UPDATE document_ocr_results
        SET status = 'completed', extracted_text = $2, extraction_method = $3,
            confidence = $4, reference_candidates = $5::JSONB, error_message = NULL, updated_at = NOW()
      WHERE document_id = $1`,
    [input.documentId, input.text, input.method, input.confidence, JSON.stringify(input.referenceCandidates)],
  );
}

export async function fail(documentId: string, message: string): Promise<void> {
  await queryOne(
    `UPDATE document_ocr_results SET status = 'failed', error_message = $2, updated_at = NOW() WHERE document_id = $1`,
    [documentId, message.slice(0, 300)],
  );
}

export async function review(documentId: string, userId: string, reviewedText: string): Promise<DocumentOcrResult | null> {
  const row = await queryOne<DbDocumentOcrResult>(
    `UPDATE document_ocr_results
        SET reviewed_text = $3, reviewed_by = $2, reviewed_at = NOW(), updated_at = NOW()
      WHERE document_id = $1 AND status = 'completed'
      RETURNING document_id, status, extracted_text, extraction_method, confidence, reference_candidates, error_message,
                reviewed_text, reviewed_by, reviewed_at, updated_at`,
    [documentId, userId, reviewedText],
  );
  return row ? mapResult(row) : null;
}

export async function searchReviewed(auctionId: string, searchText: string): Promise<DocumentOcrSearchHit[]> {
  const rows = await queryAll<{
    document_id: string;
    file_name: string;
    mime_type: string;
    excerpt: string;
    reviewed_at: Date;
  }>(
    `SELECT d.id AS document_id, d.file_name, d.mime_type,
            ts_headline('simple', o.reviewed_text, plainto_tsquery('simple', $2),
              'MaxFragments=2, MinWords=8, MaxWords=25') AS excerpt,
            o.reviewed_at
       FROM document_ocr_results o
       JOIN documents d ON d.id = o.document_id
      WHERE d.auction_id = $1
        AND o.reviewed_text IS NOT NULL
        AND to_tsvector('simple', COALESCE(o.reviewed_text, '')) @@ plainto_tsquery('simple', $2)
      ORDER BY o.reviewed_at DESC LIMIT 20`,
    [auctionId, searchText],
  );
  return rows.map((row) => ({
    documentId: row.document_id,
    fileName: row.file_name,
    mimeType: row.mime_type,
    excerpt: row.excerpt.replace(/<\/?b>/g, ""),
    reviewedAt: row.reviewed_at.toISOString(),
  }));
}

export async function findDepositReference(documentId: string): Promise<{ depositId: string; referenceHash: string } | null> {
  return queryOne<{ depositId: string; referenceHash: string }>(
    `SELECT id AS "depositId", reference_number_hash AS "referenceHash"
       FROM deposits WHERE document_id = $1 LIMIT 1`,
    [documentId],
  );
}
