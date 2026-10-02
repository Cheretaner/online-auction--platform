DROP INDEX IF EXISTS deposits_reference_hash_idx;
ALTER TABLE deposits DROP COLUMN IF EXISTS reference_number_hash;