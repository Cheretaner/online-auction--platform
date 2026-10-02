ALTER TABLE profiles
    ADD COLUMN national_id_hash CHAR(64),
    ADD COLUMN tin_number_hash CHAR(64);

CREATE INDEX profiles_national_id_hash_idx
    ON profiles (national_id_hash)
    WHERE national_id_hash IS NOT NULL;

CREATE INDEX profiles_tin_number_hash_idx
    ON profiles (tin_number_hash)
    WHERE tin_number_hash IS NOT NULL;

ALTER TABLE verifications
    ADD COLUMN document_id UUID REFERENCES documents(id) ON DELETE RESTRICT;

CREATE INDEX verifications_document_id_idx
    ON verifications (document_id)
    WHERE document_id IS NOT NULL;