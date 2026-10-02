-- Store a one-way digest alongside the encrypted deposit reference so
-- duplicate active bank references can be detected without querying plaintext.
ALTER TABLE deposits
    ADD COLUMN IF NOT EXISTS reference_number_hash CHAR(64);

CREATE INDEX IF NOT EXISTS deposits_reference_hash_idx
    ON deposits (issuing_bank, reference_number_hash)
    WHERE reference_number_hash IS NOT NULL;
