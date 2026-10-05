-- 011_document_ocr_text.up.sql
-- Adds OCR text extraction fields to documents table

ALTER TABLE documents ADD COLUMN IF NOT EXISTS extracted_text TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS ocr_status VARCHAR(20) NOT NULL DEFAULT 'none';
-- ocr_status: 'none' | 'processing' | 'completed' | 'failed' | 'unsupported'

CREATE INDEX IF NOT EXISTS idx_documents_ocr_status ON documents (ocr_status) WHERE ocr_status != 'none';
