-- Person 2 operational layer: hash-chain scoping, bidding knobs,
-- durable idempotency, transactional outbox, compliance persistence,
-- notification retries, and append-only audit enforcement.

-- 1. AUCTION BIDDING / SEALED-BID CONTROLS
ALTER TABLE auctions
    ADD COLUMN IF NOT EXISTS anti_snipe_seconds INTEGER NOT NULL DEFAULT 120,
    ADD COLUMN IF NOT EXISTS max_extensions INTEGER NOT NULL DEFAULT 5,
    ADD COLUMN IF NOT EXISTS sealed_opened_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS sealed_opened_by UUID REFERENCES profiles(id) ON DELETE RESTRICT;

ALTER TABLE auctions
    DROP CONSTRAINT IF EXISTS auctions_anti_snipe_non_negative;
ALTER TABLE auctions
    ADD CONSTRAINT auctions_anti_snipe_non_negative
    CHECK (anti_snipe_seconds >= 0);

ALTER TABLE auctions
    DROP CONSTRAINT IF EXISTS auctions_max_extensions_non_negative;
ALTER TABLE auctions
    ADD CONSTRAINT auctions_max_extensions_non_negative
    CHECK (max_extensions >= 0);

-- 2. AUDIT LEDGER SCOPE
-- UNIQUE (auction_id, sequence_no) does not protect the global ledger
-- because PostgreSQL allows duplicate NULLs. Scope NULL auction_id to a
-- well-known UUID so the hash chain stays strictly sequential.
ALTER TABLE audit_events
    ADD COLUMN IF NOT EXISTS ledger_scope UUID
    GENERATED ALWAYS AS (
        COALESCE(auction_id, '00000000-0000-0000-0000-000000000000'::UUID)
    ) STORED;

ALTER TABLE audit_events
    DROP CONSTRAINT IF EXISTS audit_events_unique_sequence;

ALTER TABLE audit_events
    ADD CONSTRAINT audit_events_unique_sequence
    UNIQUE (ledger_scope, sequence_no);

CREATE INDEX IF NOT EXISTS idx_audit_events_ledger_sequence
    ON audit_events (ledger_scope, sequence_no);

CREATE INDEX IF NOT EXISTS idx_audit_events_entity
    ON audit_events (entity_type, entity_id, occurred_at DESC);

CREATE OR REPLACE FUNCTION deny_audit_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'audit_events is append-only'
        USING ERRCODE = 'integrity_constraint_violation';
END;
$$;

DROP TRIGGER IF EXISTS audit_events_deny_update ON audit_events;
CREATE TRIGGER audit_events_deny_update
    BEFORE UPDATE OR DELETE ON audit_events
    FOR EACH ROW
    EXECUTE FUNCTION deny_audit_mutation();

-- 3. IDEMPOTENCY (durable, request-scoped)
CREATE TABLE IF NOT EXISTS idempotency_keys (
    key TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    method TEXT NOT NULL,
    path TEXT NOT NULL,
    request_hash CHAR(64) NOT NULL,
    status_code INTEGER NOT NULL,
    response JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (user_id, key)
);

CREATE INDEX IF NOT EXISTS idx_idempotency_keys_expires
    ON idempotency_keys (expires_at);

-- 4. TRANSACTIONAL OUTBOX
CREATE TABLE IF NOT EXISTS outbox_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aggregate_type TEXT NOT NULL,
    aggregate_id UUID NOT NULL,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outbox_unprocessed
    ON outbox_messages (available_at)
    WHERE processed_at IS NULL;

-- 5. COMPLIANCE CHECKS
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'compliance_check_status') THEN
        CREATE TYPE compliance_check_status AS ENUM ('pending', 'passed', 'failed');
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS compliance_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auction_id UUID NOT NULL REFERENCES auctions(id) ON DELETE RESTRICT,
    checked_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    status compliance_check_status NOT NULL,
    findings JSONB NOT NULL DEFAULT '[]'::JSONB,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_compliance_checks_auction
    ON compliance_checks (auction_id, created_at DESC);

ALTER TABLE compliance_checks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS compliance_checks_select_officers ON compliance_checks;
CREATE POLICY compliance_checks_select_officers
ON compliance_checks
FOR SELECT
USING (
    EXISTS (
        SELECT 1
        FROM auctions a
        JOIN organization_members om
          ON om.organization_id = a.org_id
        WHERE a.id = compliance_checks.auction_id
          AND a.org_id = app_current_org_id()
          AND om.user_id = app_current_user_id()
          AND om.role IN ('compliance_officer', 'organization_admin')
    )
);

-- 6. NOTIFICATION RETRIES
ALTER TABLE notifications
    ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_notifications_dispatch
    ON notifications (status, next_attempt_at)
    WHERE status IN ('pending', 'failed');

-- 7. BID VISIBILITY FOR OFFICERS
DROP POLICY IF EXISTS bids_select_org_officers ON bids;
CREATE POLICY bids_select_org_officers
ON bids
FOR SELECT
USING (
    EXISTS (
        SELECT 1
        FROM auctions a
        JOIN organization_members om
          ON om.organization_id = a.org_id
        WHERE a.id = bids.auction_id
          AND a.org_id = app_current_org_id()
          AND om.user_id = app_current_user_id()
          AND om.role IN ('compliance_officer', 'organization_admin', 'auction_officer')
    )
);

-- 8. FIX COMPLIANCE VERIFICATION POLICY
-- Previous policy required om.user_id = verifications.user_id AND current user,
-- so officers could only see their own KYC records.
DROP POLICY IF EXISTS verifications_select_compliance ON verifications;
CREATE POLICY verifications_select_compliance
ON verifications
FOR SELECT
USING (
    EXISTS (
        SELECT 1
        FROM organization_members om
        WHERE om.organization_id = app_current_org_id()
          AND om.user_id = app_current_user_id()
          AND om.role = 'compliance_officer'
    )
);

-- 9. DISPUTE / REPORT INDEXES
CREATE INDEX IF NOT EXISTS idx_disputes_raised_by
    ON disputes (raised_by, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_auction_reports_auction
    ON auction_reports (auction_id, generated_at DESC);

CREATE INDEX IF NOT EXISTS idx_anomaly_flags_auction_status
    ON anomaly_flags (auction_id, status, created_at DESC);

-- 10. SHARED TAXONOMY FOR AI CATEGORIZATION
INSERT INTO categories (name, slug, description)
VALUES
    ('Vehicles', 'vehicles', 'Cars, trucks, and other rolling stock'),
    ('Property', 'property', 'Land, buildings, and real estate'),
    ('Machinery', 'machinery', 'Industrial and agricultural equipment'),
    ('Electronics', 'electronics', 'IT, telecom, and consumer electronics'),
    ('General', 'general', 'Unclassified government surplus')
ON CONFLICT (slug) DO NOTHING;
