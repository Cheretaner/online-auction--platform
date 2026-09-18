-- Security, Row-Level Security, Organization Isolation
-- and Audit Ledger Protection

BEGIN;

-- ============================================================
-- 1. SESSION CONTEXT HELPERS
-- The API sets these values inside a transaction:
-- SET LOCAL app.current_user_id = '...';
-- SET LOCAL app.current_org_id  = '...';
-- SET LOCAL is important because the application uses a
-- connection pool. The values disappear automatically when
-- the transaction ends.

CREATE OR REPLACE FUNCTION app_current_user_id()
RETURNS UUID
LANGUAGE SQL
STABLE
AS $$
    SELECT NULLIF(
        current_setting('app.current_user_id', true),
        ''
    )::UUID;
$$;


CREATE OR REPLACE FUNCTION app_current_org_id()
RETURNS UUID
LANGUAGE SQL
STABLE
AS $$
    SELECT NULLIF(
        current_setting('app.current_org_id', true),
        ''
    )::UUID;
$$;


-- 2. ORGANIZATION MEMBERSHIP HELPER
CREATE OR REPLACE FUNCTION is_org_member(target_org_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM organization_members om
        WHERE om.organization_id = target_org_id
          AND om.user_id = app_current_user_id()
    );
$$;


-- 3. ROLE CHECK HELPER
CREATE OR REPLACE FUNCTION has_org_role(
    target_org_id UUID,
    target_role TEXT
)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM organization_members om
        WHERE om.organization_id = target_org_id
          AND om.user_id = app_current_user_id()
          AND om.role = target_role
    );
$$;



-- 4. ENABLE ROW LEVEL SECURITY
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE auctions ENABLE ROW LEVEL SECURITY;
ALTER TABLE auction_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE anomaly_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE auction_reports ENABLE ROW LEVEL SECURITY;


-- 5. ORGANIZATIONS
DROP POLICY IF EXISTS organizations_select_member
ON organizations;

CREATE POLICY organizations_select_member
ON organizations
FOR SELECT
USING (
    is_org_member(id)
);


-- 6. PROFILES
DROP POLICY IF EXISTS profiles_select_self
ON profiles;

CREATE POLICY profiles_select_self
ON profiles
FOR SELECT
USING (
    id = app_current_user_id()
);


-- 7. ORGANIZATION MEMBERS
DROP POLICY IF EXISTS organization_members_select
ON organization_members;

CREATE POLICY organization_members_select
ON organization_members
FOR SELECT
USING (
    organization_id = app_current_org_id()
    AND is_org_member(organization_id)
);


-- ============================================================
-- 8. VERIFICATIONS
-- A user can see their own verification records.
-- Compliance officers can see verification records for users
-- belonging to their organization.
-- Note:
-- The actual organization relationship for a user is obtained
-- through organization_members.

DROP POLICY IF EXISTS verifications_select_owner
ON verifications;

CREATE POLICY verifications_select_owner
ON verifications
FOR SELECT
USING (
    user_id = app_current_user_id()
);


DROP POLICY IF EXISTS verifications_select_compliance
ON verifications;

CREATE POLICY verifications_select_compliance
ON verifications
FOR SELECT
USING (
    EXISTS (
        SELECT 1
        FROM organization_members om
        WHERE om.user_id = verifications.user_id
          AND om.organization_id = app_current_org_id()
          AND om.user_id = app_current_user_id()
          AND om.role = 'compliance_officer'
    )
);


-- ============================================================
-- 9. AUCTIONS

-- Organization users can see auctions belonging to their
-- current organization.
--
-- Public published-auction access will be handled through a
-- controlled public query/API later. We do NOT expose every
-- auction here.

DROP POLICY IF EXISTS auctions_select_org_member
ON auctions;

CREATE POLICY auctions_select_org_member
ON auctions
FOR SELECT
USING (
    org_id = app_current_org_id()
    AND is_org_member(org_id)
);


-- 10. AUCTION ITEMS
DROP POLICY IF EXISTS auction_items_select_org_member
ON auction_items;

CREATE POLICY auction_items_select_org_member
ON auction_items
FOR SELECT
USING (
    EXISTS (
        SELECT 1
        FROM auctions a
        WHERE a.id = auction_items.auction_id
          AND a.org_id = app_current_org_id()
          AND is_org_member(a.org_id)
    )
);


-- ============================================================
-- 11. DOCUMENTS
-- Documents are private by default.
-- The owner can see their uploaded documents.
-- Organization users can see auction documents belonging to
-- their organization.
-- Verification documents will receive additional protection
-- in the document/KYC service layer.


DROP POLICY IF EXISTS documents_select_owner
ON documents;

CREATE POLICY documents_select_owner
ON documents
FOR SELECT
USING (
    uploaded_by = app_current_user_id()
);


DROP POLICY IF EXISTS documents_select_org
ON documents;

CREATE POLICY documents_select_org
ON documents
FOR SELECT
USING (
    auction_id IS NOT NULL
    AND EXISTS (
        SELECT 1
        FROM auctions a
        WHERE a.id = documents.auction_id
          AND a.org_id = app_current_org_id()
          AND is_org_member(a.org_id)
    )
);


-- 12. DEPOSITS
-- A bidder may see their own deposit.
-- Organization officers will later access deposits through
-- controlled service operations.
DROP POLICY IF EXISTS deposits_select_bidder
ON deposits;

CREATE POLICY deposits_select_bidder
ON deposits
FOR SELECT
USING (
    bidder_id = app_current_user_id()
);


--  -- ============================================================
-- 13. BIDS--
-- We intentionally do NOT create a generic INSERT policy here.
--
-- Bid insertion must happen through the bidding service and
-- inside a transaction that:
--
-- 1. Locks the auction row
-- 2. Checks auction state
-- 3. Checks bidder verification
-- 4. Checks verified deposit
-- 5. Checks eligibility
-- 6. Checks minimum bid
-- 7. Inserts the bid
-- 8. Updates the auction
-- 9. Appends the audit event
-- 10. Commits everything together
--
-- This follows the required concurrency-safe bidding design.
--============================================================


DROP POLICY IF EXISTS bids_select_owner
ON bids;

CREATE POLICY bids_select_owner
ON bids
FOR SELECT
USING (
    bidder_id = app_current_user_id()
);


-- ============================================================
-- 14. SEALED BID CONFIDENTIALITY
-- Sealed bid amounts must not be exposed before opening.
--
-- The service/API will additionally expose only safe fields.
--
-- This policy restricts direct bid reads to the bidder's own
-- records. Therefore another bidder cannot read the raw bid.
--
-- Administrative users do NOT automatically receive access.
---- ============================================================



-- 15. ANOMALY FLAGS
-- Only compliance officers can access anomaly flags for their
-- organization's auctions.
DROP POLICY IF EXISTS anomaly_flags_select_compliance
ON anomaly_flags;

CREATE POLICY anomaly_flags_select_compliance
ON anomaly_flags
FOR SELECT
USING (
    EXISTS (
        SELECT 1
        FROM auctions a
        JOIN organization_members om
          ON om.organization_id = a.org_id
        WHERE a.id = anomaly_flags.auction_id
          AND a.org_id = app_current_org_id()
          AND om.user_id = app_current_user_id()
          AND om.role = 'compliance_officer'
    )
);


-- ============================================================
-- 16. AUDIT EVENTS
-- Organization members can read audit history for their
-- organization's auctions.
-- Inserts are allowed only when actor_id matches the current
-- authenticated user.
-- UPDATE and DELETE are intentionally NOT allowed.

DROP POLICY IF EXISTS audit_events_select_org
ON audit_events;

CREATE POLICY audit_events_select_org
ON audit_events
FOR SELECT
USING (
    auction_id IS NOT NULL
    AND EXISTS (
        SELECT 1
        FROM auctions a
        WHERE a.id = audit_events.auction_id
          AND a.org_id = app_current_org_id()
          AND is_org_member(a.org_id)
    )
);


DROP POLICY IF EXISTS audit_events_insert_actor
ON audit_events;

CREATE POLICY audit_events_insert_actor
ON audit_events
FOR INSERT
WITH CHECK (
    actor_id = app_current_user_id()
);


-- 17. AUDIT LEDGER IMMUTABILITY
-- No normal application role may update or delete audit events.
-- The audit ledger is append-only.

REVOKE UPDATE, DELETE, TRUNCATE
ON audit_events
FROM PUBLIC;



-- 18. NOTIFICATIONS
DROP POLICY IF EXISTS notifications_select_owner
ON notifications;

CREATE POLICY notifications_select_owner
ON notifications
FOR SELECT
USING (
    user_id = app_current_user_id()
);


-- 19. DISPUTES
-- A user can see disputes they raised.
-- Compliance officers can see disputes belonging to their
-- organization.

DROP POLICY IF EXISTS disputes_select_owner
ON disputes;

CREATE POLICY disputes_select_owner
ON disputes
FOR SELECT
USING (
    raised_by = app_current_user_id()
);


DROP POLICY IF EXISTS disputes_select_compliance
ON disputes;

CREATE POLICY disputes_select_compliance
ON disputes
FOR SELECT
USING (
    EXISTS (
        SELECT 1
        FROM auctions a
        JOIN organization_members om
          ON om.organization_id = a.org_id
        WHERE a.id = disputes.auction_id
          AND a.org_id = app_current_org_id()
          AND om.user_id = app_current_user_id()
          AND om.role = 'compliance_officer'
    )
);


-- 20. AUCTION REPORTS
-- Organization members can access reports for their auctions.

DROP POLICY IF EXISTS auction_reports_select_org
ON auction_reports;

CREATE POLICY auction_reports_select_org
ON auction_reports
FOR SELECT
USING (
    EXISTS (
        SELECT 1
        FROM auctions a
        WHERE a.id = auction_reports.auction_id
          AND a.org_id = app_current_org_id()
          AND is_org_member(a.org_id)
    )
);


-- 21. CATEGORIES
-- Categories are intentionally not restricted by organization.
-- They form the shared controlled taxonomy used by the AI
-- categorization system.
-- RLS remains disabled here so public discovery and taxonomy
-- lookup remain straightforward.


-- 22. SECURITY COMMENTS
COMMENT ON FUNCTION app_current_user_id()
IS 'Returns the authenticated application user from transaction-local session context.';

COMMENT ON FUNCTION app_current_org_id()
IS 'Returns the current organization from transaction-local session context.';

COMMENT ON FUNCTION is_org_member(UUID)
IS 'Checks whether the current application user belongs to the target organization.';

COMMENT ON FUNCTION has_org_role(UUID, TEXT)
IS 'Checks whether the current application user has a specific role in an organization.';

COMMENT ON TABLE audit_events
IS 'Append-only hash-chained audit ledger. Application UPDATE and DELETE access is prohibited.';

COMMIT;