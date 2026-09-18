CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ENUM TYPES
CREATE TYPE auction_status AS ENUM (
    'draft',
    'pending_review',
    'scheduled',
    'live',
    'closed',
    'under_review',
    'awarded',
    'cancelled'
);

CREATE TYPE auction_type AS ENUM (
    'open_ascending',
    'sealed_bid'
);

CREATE TYPE verification_status AS ENUM (
    'unverified',
    'pending',
    'verified',
    'rejected'
);

CREATE TYPE verification_decision AS ENUM (
    'approved',
    'rejected',
    'resubmission_required'
);

CREATE TYPE deposit_status AS ENUM (
    'pending',
    'verified',
    'rejected',
    'released'
);

CREATE TYPE bid_status AS ENUM (
    'active',
    'withdrawn',
    'superseded'
);

CREATE TYPE anomaly_severity AS ENUM (
    'low',
    'medium',
    'high'
);

CREATE TYPE anomaly_status AS ENUM (
    'open',
    'reviewed',
    'dismissed',
    'escalated'
);

CREATE TYPE dispute_status AS ENUM (
    'open',
    'under_review',
    'resolved',
    'rejected'
);

CREATE TYPE notification_channel AS ENUM (
    'in_app',
    'email'
);

CREATE TYPE notification_status AS ENUM (
    'pending',
    'sent',
    'failed',
    'read'
);



-- HELPER FUNCTIONS
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;



-- ALL MAIN 13 TABLES and Two two another tables(profile and )

--1 ORGANIZATIONS
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    taxpayer_id TEXT NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);



--2 PROFILES
CREATE TABLE profiles (
 -- no org_id because organization membership and role assignment separately from the user's profile.
    id UUID PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    verification_status verification_status
        NOT NULL DEFAULT 'unverified',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);



-- 3 ORGANIZATION MEMBERS
CREATE TABLE organization_members (
    organization_id UUID NOT NULL
        REFERENCES organizations(id)
        ON DELETE CASCADE,

    user_id UUID NOT NULL
        REFERENCES profiles(id)
        ON DELETE CASCADE,

    role TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (organization_id, user_id),
    CONSTRAINT organization_members_role_check
        CHECK (
            role IN (
                'org_admin',
                'auction_officer',
                'compliance_officer'
            )
        )
);



-- 4 VERIFICATIONS
CREATE TABLE verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL
        REFERENCES profiles(id)
        ON DELETE CASCADE,

    document_type TEXT NOT NULL,
    document_number TEXT NOT NULL,
    status verification_status NOT NULL DEFAULT 'pending',
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_by UUID
        REFERENCES profiles(id),
    reviewed_at TIMESTAMPTZ,
    decision verification_decision,
    decision_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT verifications_review_consistency CHECK (
        (
            status = 'pending'
            AND reviewed_by IS NULL
            AND reviewed_at IS NULL
            AND decision IS NULL
        )
        OR
        (
            status IN ('verified', 'rejected')
            AND reviewed_by IS NOT NULL
            AND reviewed_at IS NOT NULL
            AND decision IS NOT NULL
        )
        OR
        (
            status = 'unverified'
        )
    )
);


-- Only one open verification submission per user.
CREATE UNIQUE INDEX uq_verifications_open_user
    ON verifications(user_id)
    WHERE status = 'pending';



-- 5 CATEGORIES
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id UUID
        REFERENCES categories(id)
        ON DELETE RESTRICT,

    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);



-- 6 AUCTIONS
CREATE TABLE auctions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL
        REFERENCES organizations(id)
        ON DELETE RESTRICT,

    title TEXT NOT NULL,
    description TEXT,
    auction_type auction_type NOT NULL,
    status auction_status NOT NULL DEFAULT 'draft',

    -- Monetary values are exact decimals.
    start_price NUMERIC(14,2) NOT NULL,
    reserve_price NUMERIC(14,2),
    min_increment NUMERIC(14,2) NOT NULL,
    deposit_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
    current_highest_bid NUMERIC(14,2) NOT NULL DEFAULT 0,
    bid_count INTEGER NOT NULL DEFAULT 0,
    opens_at TIMESTAMPTZ NOT NULL,
    closes_at TIMESTAMPTZ NOT NULL,
    original_closes_at TIMESTAMPTZ NOT NULL,
    extension_count INTEGER NOT NULL DEFAULT 0,
    created_by UUID NOT NULL
        REFERENCES profiles(id)
        ON DELETE RESTRICT,

    approved_by UUID
        REFERENCES profiles(id)
        ON DELETE RESTRICT,

    winner_id UUID
        REFERENCES profiles(id)
        ON DELETE RESTRICT,

    winning_amount NUMERIC(14,2),
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    
    -- Monetary constraints
    CONSTRAINT auctions_start_price_non_negative
        CHECK (start_price >= 0),

    CONSTRAINT auctions_reserve_price_non_negative
        CHECK (
            reserve_price IS NULL
            OR reserve_price >= 0
        ),

    CONSTRAINT auctions_min_increment_positive
        CHECK (min_increment > 0),

    CONSTRAINT auctions_deposit_non_negative
        CHECK (deposit_amount >= 0),

    CONSTRAINT auctions_current_highest_non_negative
        CHECK (current_highest_bid >= 0),

    CONSTRAINT auctions_winning_amount_non_negative
        CHECK (
            winning_amount IS NULL
            OR winning_amount >= 0
        ),

    
    -- Timeline constraints
    CONSTRAINT auctions_closing_after_opening
        CHECK (closes_at > opens_at),

    CONSTRAINT auctions_original_closing_after_opening
        CHECK (original_closes_at > opens_at),

    CONSTRAINT auctions_closing_not_before_original
        CHECK (closes_at >= original_closes_at),

    
    -- Counters
    CONSTRAINT auctions_bid_count_non_negative
        CHECK (bid_count >= 0),

    CONSTRAINT auctions_extension_count_non_negative
        CHECK (extension_count >= 0),

    
    -- Two-person approval rule
    CONSTRAINT auctions_approval_two_person_rule
        CHECK (
            approved_by IS NULL
            OR approved_by <> created_by
        )
);



-- 7 AUCTION ITEMS
CREATE TABLE auction_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auction_id UUID NOT NULL
        REFERENCES auctions(id)
        ON DELETE CASCADE,
    category_id UUID
        REFERENCES categories(id)
        ON DELETE RESTRICT,

    title TEXT NOT NULL,
    description TEXT,
    quantity NUMERIC(14,2) NOT NULL DEFAULT 1,
    unit TEXT,

    region TEXT,
    city TEXT,

    ai_category_suggestion TEXT,
    ai_sub_category TEXT,
    ai_confidence NUMERIC(5,4),
    ai_rationale TEXT,
    category_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT auction_items_quantity_positive
        CHECK (quantity > 0),

    CONSTRAINT auction_items_ai_confidence_valid
        CHECK (
            ai_confidence IS NULL
            OR (
                ai_confidence >= 0
                AND ai_confidence <= 1
            )
        )
);



-- 8 DOCUMENTS
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auction_id UUID
        REFERENCES auctions(id)
        ON DELETE CASCADE,

    uploaded_by UUID NOT NULL
        REFERENCES profiles(id)
        ON DELETE RESTRICT,

    document_type TEXT NOT NULL,
    file_name TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    checksum_sha256 CHAR(64) NOT NULL,
    is_private BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT documents_file_size_positive
        CHECK (file_size_bytes > 0),

    CONSTRAINT documents_sha256_format
        CHECK (checksum_sha256 ~ '^[a-fA-F0-9]{64}$')
);



-- 9 DEPOSITS
CREATE TABLE deposits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auction_id UUID NOT NULL
        REFERENCES auctions(id)
        ON DELETE RESTRICT,

    bidder_id UUID NOT NULL
        REFERENCES profiles(id)
        ON DELETE RESTRICT,

    reference_number TEXT NOT NULL,
    issuing_bank TEXT NOT NULL,
    amount NUMERIC(14,2) NOT NULL,
    document_id UUID
        REFERENCES documents(id)
        ON DELETE RESTRICT,

    status deposit_status NOT NULL DEFAULT 'pending',
    verified_by UUID
        REFERENCES profiles(id)
        ON DELETE RESTRICT,

    verified_at TIMESTAMPTZ,
    released_at TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT deposits_amount_positive
        CHECK (amount > 0),

    CONSTRAINT deposits_verification_consistency CHECK (
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
        OR
        (
            status IN ('rejected', 'released')
        )
    )
);


-- One deposit registration per bidder per auction.
CREATE UNIQUE INDEX uq_deposits_auction_bidder
    ON deposits(auction_id, bidder_id);



-- 10 BIDS
CREATE TABLE bids (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auction_id UUID NOT NULL
        REFERENCES auctions(id)
        ON DELETE RESTRICT,

    bidder_id UUID NOT NULL
        REFERENCES profiles(id)
        ON DELETE RESTRICT,

    amount NUMERIC(14,2) NOT NULL,
    status bid_status NOT NULL DEFAULT 'active',
    is_sealed BOOLEAN NOT NULL DEFAULT FALSE,
    commitment_hash TEXT,
    placed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    idempotency_key TEXT NOT NULL,
    ip_hash TEXT,
    withdrawn_at TIMESTAMPTZ,
    withdrawal_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT bids_amount_positive
        CHECK (amount > 0),

    CONSTRAINT bids_sealed_commitment_consistency CHECK (
        (
            is_sealed = FALSE
            AND commitment_hash IS NULL
        )
        OR
        (
            is_sealed = TRUE
            AND commitment_hash IS NOT NULL
        )
    ),

    CONSTRAINT bids_withdrawal_consistency CHECK (
        (
            status <> 'withdrawn'
        )
        OR
        (
            status = 'withdrawn'
            AND withdrawn_at IS NOT NULL
            AND withdrawal_reason IS NOT NULL
        )
    )
);


-- Idempotency is globally unique for mutating bid requests.
CREATE UNIQUE INDEX uq_bids_idempotency_key
    ON bids(idempotency_key);


-- Winner determination / bid history.
CREATE INDEX idx_bids_auction_amount_time
    ON bids(
        auction_id,
        amount DESC,
        placed_at ASC
    );


CREATE INDEX idx_bids_bidder
    ON bids(bidder_id);


CREATE INDEX idx_bids_auction_status
    ON bids(
        auction_id,
        status
    );



-- 11 ANOMALY FLAGS
CREATE TABLE anomaly_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auction_id UUID NOT NULL
        REFERENCES auctions(id)
        ON DELETE RESTRICT,

    subject_accounts UUID[] NOT NULL DEFAULT '{}',
    score NUMERIC(5,2) NOT NULL,
    severity anomaly_severity NOT NULL,
    status anomaly_status NOT NULL DEFAULT 'open',
    triggered_rules TEXT[] NOT NULL DEFAULT '{}',
    feature_values JSONB NOT NULL DEFAULT '{}'::JSONB,
    explanation TEXT,
    reviewed_by UUID
        REFERENCES profiles(id)
        ON DELETE RESTRICT,

    reviewed_at TIMESTAMPTZ,
    decision_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT anomaly_flags_score_range
        CHECK (
            score >= 0
            AND score <= 100
        ),

    CONSTRAINT anomaly_flags_subjects_not_empty
        CHECK (cardinality(subject_accounts) > 0)
);



-- 12 AUDIT EVENTS
-- This table is append-only at the application level.
CREATE TABLE audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auction_id UUID
        REFERENCES auctions(id)
        ON DELETE RESTRICT,

    sequence_no BIGINT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    actor_id UUID
        REFERENCES profiles(id)
        ON DELETE RESTRICT,

    actor_role TEXT NOT NULL,
    action TEXT NOT NULL,
    payload JSONB NOT NULL,
    prev_hash CHAR(64) NOT NULL,
    hash CHAR(64) NOT NULL UNIQUE,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT audit_events_sequence_positive
        CHECK (sequence_no > 0),

    CONSTRAINT audit_events_prev_hash_format
        CHECK (prev_hash ~ '^[a-fA-F0-9]{64}$'),

    CONSTRAINT audit_events_hash_format
        CHECK (hash ~ '^[a-fA-F0-9]{64}$'),

    CONSTRAINT audit_events_unique_sequence
        UNIQUE (auction_id, sequence_no)
);


CREATE INDEX idx_audit_events_auction_sequence
    ON audit_events(
        auction_id,
        sequence_no
    );



-- 13 NOTIFICATIONS
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL
        REFERENCES profiles(id)
        ON DELETE CASCADE,

    channel notification_channel NOT NULL,
    status notification_status NOT NULL DEFAULT 'pending',
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    related_entity_type TEXT,
    related_entity_id UUID,
    provider_message_id TEXT,
    sent_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    failure_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE INDEX idx_notifications_user_read
    ON notifications(
        user_id,
        status,
        created_at DESC
    );



-- 14 DISPUTES
CREATE TABLE disputes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auction_id UUID NOT NULL
        REFERENCES auctions(id)
        ON DELETE RESTRICT,

    raised_by UUID NOT NULL
        REFERENCES profiles(id)
        ON DELETE RESTRICT,

    assigned_reviewer UUID
        REFERENCES profiles(id)
        ON DELETE RESTRICT,

    status dispute_status NOT NULL DEFAULT 'open',
    reason TEXT NOT NULL,
    evidence JSONB NOT NULL DEFAULT '{}'::JSONB,
    decision TEXT,
    decision_reason TEXT,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE INDEX idx_disputes_auction
    ON disputes(auction_id);

CREATE INDEX idx_disputes_status
    ON disputes(status);



-- 15 AUCTION REPORTS
CREATE TABLE auction_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    auction_id UUID NOT NULL
        REFERENCES auctions(id)
        ON DELETE RESTRICT,

    report_version INTEGER NOT NULL DEFAULT 1,
    chain_head CHAR(64),
    chain_verified BOOLEAN NOT NULL DEFAULT FALSE,
    chain_verification_error TEXT,
    report_data JSONB NOT NULL DEFAULT '{}'::JSONB,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT auction_reports_version_positive
        CHECK (report_version > 0)
);


-- One report version per auction/version.
CREATE UNIQUE INDEX uq_auction_reports_version
    ON auction_reports(
        auction_id,
        report_version
    );



-- UPDATED_AT TRIGGERS
CREATE TRIGGER organizations_set_updated_at
BEFORE UPDATE ON organizations
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


CREATE TRIGGER profiles_set_updated_at
BEFORE UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


CREATE TRIGGER verifications_set_updated_at
BEFORE UPDATE ON verifications
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


CREATE TRIGGER categories_set_updated_at
BEFORE UPDATE ON categories
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


CREATE TRIGGER auctions_set_updated_at
BEFORE UPDATE ON auctions
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


CREATE TRIGGER auction_items_set_updated_at
BEFORE UPDATE ON auction_items
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


CREATE TRIGGER deposits_set_updated_at
BEFORE UPDATE ON deposits
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


CREATE TRIGGER anomaly_flags_set_updated_at
BEFORE UPDATE ON anomaly_flags
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


CREATE TRIGGER notifications_set_updated_at
BEFORE UPDATE ON notifications
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


CREATE TRIGGER disputes_set_updated_at
BEFORE UPDATE ON disputes
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();