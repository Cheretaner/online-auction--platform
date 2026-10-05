-- 012_document_fulltext_search.down.sql

DROP INDEX IF EXISTS idx_documents_auction_id_ocr;
DROP INDEX IF EXISTS idx_documents_type_ocr_status;
DROP INDEX IF EXISTS idx_documents_extracted_text_simple_fts;
DROP INDEX IF EXISTS idx_documents_extracted_text_fts;
