-- Final business workflow: paid tender-document access, dynamic bid forms,
-- CPO proof review, and stamped loser refund authorizations.
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS requires_payment BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE auctions
  ADD COLUMN IF NOT EXISTS document_access_fee NUMERIC(14,2) NOT NULL DEFAULT 1
  CHECK (document_access_fee > 0);

CREATE TABLE IF NOT EXISTS auction_document_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id UUID NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
  bidder_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  payment_reference TEXT NOT NULL UNIQUE,
  amount NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'succeeded', 'failed', 'reconciliation_required')),
  provider_reference TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (auction_id, bidder_id)
);

CREATE INDEX IF NOT EXISTS auction_document_access_bidder_idx
  ON auction_document_access (bidder_id, status);

CREATE TABLE IF NOT EXISTS auction_form_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id UUID NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  field_type TEXT NOT NULL CHECK (field_type IN ('text', 'number', 'choice', 'range')),
  options JSONB NOT NULL DEFAULT '[]'::JSONB,
  min_value NUMERIC(14,2),
  max_value NUMERIC(14,2),
  required BOOLEAN NOT NULL DEFAULT TRUE,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (auction_id, position)
);

CREATE TABLE IF NOT EXISTS bid_form_responses (
  bid_id UUID PRIMARY KEY REFERENCES bids(id) ON DELETE CASCADE,
  responses JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS refund_letters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id UUID NOT NULL REFERENCES auctions(id) ON DELETE RESTRICT,
  bidder_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  deposit_id UUID NOT NULL REFERENCES deposits(id) ON DELETE RESTRICT,
  letter_number TEXT NOT NULL UNIQUE,
  body TEXT NOT NULL,
  official_stamp TEXT NOT NULL,
  signed_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (auction_id, bidder_id)
);
