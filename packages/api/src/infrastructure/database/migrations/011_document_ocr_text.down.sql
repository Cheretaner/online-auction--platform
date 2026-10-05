-- 011_document_ocr_text.down.sql
DROP INDEX IF EXISTS idx_documents_ocr_status;
ALTER TABLE documents DROP COLUMN IF EXISTS ocr_status;
ALTER TABLE documents DROP COLUMN IF EXISTS extracted_text;
