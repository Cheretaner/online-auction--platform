-- 012_document_fulltext_search.up.sql
--
-- Adds full-text search capabilities for OCR extracted text

-- Create GIN index for full-text search on extracted_text
CREATE INDEX IF NOT EXISTS idx_documents_extracted_text_fts 
ON documents USING GIN (to_tsvector('english', COALESCE(extracted_text, '')));

-- Create composite GIN index for multi-language support (English + Amharic)
-- For Amharic, we use simple tokenization since PostgreSQL doesn't have built-in Amharic dictionary
CREATE INDEX IF NOT EXISTS idx_documents_extracted_text_simple_fts 
ON documents USING GIN (to_tsvector('simple', COALESCE(extracted_text, '')));

-- Add index on document type for filtered searches
CREATE INDEX IF NOT EXISTS idx_documents_type_ocr_status 
ON documents(document_type, ocr_status) 
WHERE ocr_status = 'completed';

-- Add index on auction_id for document search within specific auctions
CREATE INDEX IF NOT EXISTS idx_documents_auction_id_ocr 
ON documents(auction_id) 
WHERE ocr_status = 'completed' AND extracted_text IS NOT NULL;

COMMENT ON INDEX idx_documents_extracted_text_fts IS 'Full-text search index for OCR extracted text (English dictionary)';
COMMENT ON INDEX idx_documents_extracted_text_simple_fts IS 'Full-text search index for OCR extracted text (Simple tokenization for Amharic)';
