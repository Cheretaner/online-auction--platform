DROP INDEX IF EXISTS provider_transactions_deposit_created_idx;
DROP TABLE IF EXISTS provider_transactions;

ALTER TABLE deposits DROP CONSTRAINT IF EXISTS deposits_verification_consistency;
ALTER TABLE deposits ADD CONSTRAINT deposits_verification_consistency CHECK (
    (
        status = 'pending'
        AND verified_by IS NULL
        AND verified_at IS NULL
    )
    OR
    (
        status = 'verified'
        AND verified_by IS NOT NULL
        AND verified_at IS NOT NULL
    )
    OR status IN ('rejected', 'released')
);

ALTER TABLE deposits DROP COLUMN IF EXISTS provider_verified;
ALTER TABLE deposits DROP CONSTRAINT IF EXISTS deposits_instrument_type_check;
ALTER TABLE deposits ADD CONSTRAINT deposits_instrument_type_check
    CHECK (instrument_type IN ('cpo', 'bank_guarantee', 'transfer'));