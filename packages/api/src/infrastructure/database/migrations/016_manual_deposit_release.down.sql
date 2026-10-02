DROP INDEX IF EXISTS deposits_release_document_idx;
ALTER TABLE deposits
    DROP COLUMN IF EXISTS release_document_id,
    DROP COLUMN IF EXISTS release_reference_hash,
    DROP COLUMN IF EXISTS release_reference_number;