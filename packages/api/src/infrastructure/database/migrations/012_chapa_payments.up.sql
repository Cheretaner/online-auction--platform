ALTER TABLE deposits
    ADD COLUMN provider_verified BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE deposits DROP CONSTRAINT deposits_instrument_type_check;
ALTER TABLE deposits ADD CONSTRAINT deposits_instrument_type_check
    CHECK (instrument_type IN ('cpo', 'bank_guarantee', 'transfer', 'chapa'));

ALTER TABLE deposits DROP CONSTRAINT deposits_verification_consistency;
ALTER TABLE deposits ADD CONSTRAINT deposits_verification_consistency CHECK (
    (
        status = 'pending'
        AND verified_by IS NULL
        AND verified_at IS NULL
        AND provider_verified = FALSE
    )
    OR
    (
        status = 'verified'
        AND verified_at IS NOT NULL
        AND (verified_by IS NOT NULL OR provider_verified = TRUE)
    )
    OR status IN ('rejected', 'released')
);

CREATE TABLE provider_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider TEXT NOT NULL CHECK (provider = 'chapa'),
    deposit_id UUID NOT NULL REFERENCES deposits(id) ON DELETE RESTRICT,
    tx_ref TEXT NOT NULL UNIQUE,
    provider_reference TEXT,
    amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
    currency CHAR(3) NOT NULL DEFAULT 'ETB' CHECK (currency = 'ETB'),
    status TEXT NOT NULL CHECK (status IN ('initializing', 'pending', 'succeeded', 'failed', 'refund_pending', 'refunded', 'reconciliation_required')),
    checkout_url TEXT,
    processed_event_hash CHAR(64),
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT provider_transactions_event_hash_format CHECK (
        processed_event_hash IS NULL OR processed_event_hash ~ '^[a-f0-9]{64}$'
    )
);

CREATE INDEX provider_transactions_deposit_created_idx
    ON provider_transactions (deposit_id, created_at DESC);