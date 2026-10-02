CREATE TABLE provider_refunds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_transaction_id UUID NOT NULL UNIQUE
        REFERENCES provider_transactions(id) ON DELETE RESTRICT,
    deposit_id UUID NOT NULL REFERENCES deposits(id) ON DELETE RESTRICT,
    bidder_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    auction_id UUID NOT NULL REFERENCES auctions(id) ON DELETE RESTRICT,
    tx_ref TEXT NOT NULL,
    merchant_reference TEXT NOT NULL UNIQUE,
    provider_reference TEXT UNIQUE,
    amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
    status TEXT NOT NULL DEFAULT 'requested'
        CHECK (status IN ('requested', 'initiated', 'processing', 'refunded', 'reversed', 'failed', 'reconciliation_required')),
    reason TEXT NOT NULL,
    last_checked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX provider_refunds_status_created_idx
    ON provider_refunds (status, created_at)
    WHERE status IN ('initiated', 'processing');