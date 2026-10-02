DROP INDEX IF EXISTS verifications_document_id_idx;
ALTER TABLE verifications DROP COLUMN IF EXISTS document_id;

DROP INDEX IF EXISTS profiles_tin_number_hash_idx;
DROP INDEX IF EXISTS profiles_national_id_hash_idx;
ALTER TABLE profiles
    DROP COLUMN IF EXISTS tin_number_hash,
    DROP COLUMN IF EXISTS national_id_hash;