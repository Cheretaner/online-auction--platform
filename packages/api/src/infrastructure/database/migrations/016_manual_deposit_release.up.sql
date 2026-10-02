ALTER TABLE deposits
    ADD COLUMN release_reference_number TEXT,
    ADD COLUMN release_reference_hash CHAR(64),
    ADD COLUMN release_document_id UUID REFERENCES documents(id) ON DELETE RESTRICT;

CREATE INDEX deposits_release_document_idx
    ON deposits (release_document_id)
    WHERE release_document_id IS NOT NULL;