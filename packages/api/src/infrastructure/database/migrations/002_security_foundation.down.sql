BEGIN;
-- 1. REMOVE FUNCTION COMMENTS
COMMENT ON FUNCTION app_current_user_id()
IS NULL;

COMMENT ON FUNCTION app_current_org_id()
IS NULL;

COMMENT ON FUNCTION is_org_member(UUID)
IS NULL;

COMMENT ON FUNCTION has_org_role(UUID, TEXT)
IS NULL;

COMMENT ON TABLE audit_events
IS NULL;


-- 2. REMOVE RLS POLICIES
-- Organizations
DROP POLICY IF EXISTS organizations_select_member
ON organizations;


-- Profiles
DROP POLICY IF EXISTS profiles_select_self
ON profiles;


-- Organization members
DROP POLICY IF EXISTS organization_members_select
ON organization_members;


-- Verifications
DROP POLICY IF EXISTS verifications_select_owner
ON verifications;

DROP POLICY IF EXISTS verifications_select_compliance
ON verifications;


-- Auctions
DROP POLICY IF EXISTS auctions_select_org_member
ON auctions;


-- Auction items
DROP POLICY IF EXISTS auction_items_select_org_member
ON auction_items;


-- Documents
DROP POLICY IF EXISTS documents_select_owner
ON documents;

DROP POLICY IF EXISTS documents_select_org
ON documents;


-- Deposits
DROP POLICY IF EXISTS deposits_select_bidder
ON deposits;


-- Bids
DROP POLICY IF EXISTS bids_select_owner
ON bids;


-- Anomaly flags
DROP POLICY IF EXISTS anomaly_flags_select_compliance
ON anomaly_flags;


-- Audit events
DROP POLICY IF EXISTS audit_events_select_org
ON audit_events;

DROP POLICY IF EXISTS audit_events_insert_actor
ON audit_events;


-- Notifications
DROP POLICY IF EXISTS notifications_select_owner
ON notifications;


-- Disputes
DROP POLICY IF EXISTS disputes_select_owner
ON disputes;

DROP POLICY IF EXISTS disputes_select_compliance
ON disputes;


-- Auction reports
DROP POLICY IF EXISTS auction_reports_select_org
ON auction_reports;


-- 3. RESTORE AUDIT EVENT PRIVILEGES
-- The UP migration revoked these privileges from PUBLIC.
-- Reversing that change restores the previous state.

GRANT UPDATE, DELETE, TRUNCATE
ON audit_events
TO PUBLIC;


-- 4. DISABLE ROW LEVEL SECURITY
-- Categories were never enabled, so they are intentionally
-- excluded here.

ALTER TABLE organizations DISABLE ROW LEVEL SECURITY;
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE verifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE auctions DISABLE ROW LEVEL SECURITY;
ALTER TABLE auction_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE deposits DISABLE ROW LEVEL SECURITY;
ALTER TABLE bids DISABLE ROW LEVEL SECURITY;
ALTER TABLE anomaly_flags DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events DISABLE ROW LEVEL SECURITY;
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE disputes DISABLE ROW LEVEL SECURITY;
ALTER TABLE auction_reports DISABLE ROW LEVEL SECURITY;

-- 5. DROP SECURITY HELPER FUNCTIONS
DROP FUNCTION IF EXISTS has_org_role(UUID, TEXT);
DROP FUNCTION IF EXISTS is_org_member(UUID);
DROP FUNCTION IF EXISTS app_current_org_id();
DROP FUNCTION IF EXISTS app_current_user_id();


COMMIT;