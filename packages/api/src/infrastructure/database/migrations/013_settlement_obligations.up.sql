CREATE TABLE settlement_obligations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auction_id UUID NOT NULL UNIQUE REFERENCES auctions(id) ON DELETE RESTRICT,
    winner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
    currency CHAR(3) NOT NULL DEFAULT 'ETB' CHECK (currency = 'ETB'),
    status TEXT NOT NULL DEFAULT 'due'
        CHECK (status IN ('due', 'payment_pending', 'paid', 'cancelled', 'reconciliation_required')),
    due_at TIMESTAMPTZ NOT NULL,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT settlement_paid_consistency CHECK (
        (status = 'paid' AND paid_at IS NOT NULL)
        OR (status <> 'paid')
    )
);

CREATE INDEX settlement_obligations_winner_status_idx
    ON settlement_obligations (winner_id, status, due_at);

ALTER TABLE provider_transactions
    ADD COLUMN settlement_id UUID REFERENCES settlement_obligations(id) ON DELETE RESTRICT;

ALTER TABLE provider_transactions ALTER COLUMN deposit_id DROP NOT NULL;
ALTER TABLE provider_transactions ADD CONSTRAINT provider_transactions_subject_check
    CHECK ((deposit_id IS NOT NULL AND settlement_id IS NULL) OR (deposit_id IS NULL AND settlement_id IS NOT NULL));

CREATE INDEX provider_transactions_settlement_created_idx
    ON provider_transactions (settlement_id, created_at DESC)
    WHERE settlement_id IS NOT NULL;