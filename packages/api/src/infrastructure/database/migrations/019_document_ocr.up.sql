CREATE TABLE document_ocr_results (
    document_id UUID PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('processing', 'completed', 'failed')),
    extracted_text TEXT,
    extraction_method TEXT CHECK (extraction_method IN ('embedded_text', 'tesseract')),
    confidence NUMERIC(5,2) CHECK (confidence BETWEEN 0 AND 100),
    reference_candidates JSONB NOT NULL DEFAULT '[]'::JSONB CHECK (jsonb_typeof(reference_candidates) = 'array'),
    error_message TEXT,
    reviewed_text TEXT,
    reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT document_ocr_review_requires_text CHECK (reviewed_text IS NULL OR reviewed_at IS NOT NULL)
);

CREATE INDEX document_ocr_search_idx
    ON document_ocr_results USING GIN (to_tsvector('simple', COALESCE(reviewed_text, '')));

CREATE TRIGGER document_ocr_results_set_updated_at
BEFORE UPDATE ON document_ocr_results
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
