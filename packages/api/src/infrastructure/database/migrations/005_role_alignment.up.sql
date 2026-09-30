UPDATE organization_members
   SET role = 'org_admin'
 WHERE role = 'organization_admin';

-- Widen the constraint: bidders may be recorded against an organization,
-- and the legacy alias is accepted on write so a half-deployed older API
-- node cannot crash on insert. mapDbRole() collapses it on read.
ALTER TABLE organization_members
    DROP CONSTRAINT IF EXISTS organization_members_role_check;

ALTER TABLE organization_members
    ADD CONSTRAINT organization_members_role_check
    CHECK (
        role IN (
            'org_admin',
            'organization_admin',
            'auction_officer',
            'compliance_officer',
            'bidder'
        )
    );

CREATE INDEX IF NOT EXISTS idx_organization_members_user
    ON organization_members (user_id);

-- ============================================================
-- 2. PLATFORM-LEVEL ROLE (super_admin bootstrap)
-- ============================================================
-- organization_members only models roles *inside* an organization, so there
-- was no way to represent a platform operator, and therefore no way to
-- create the first organization. platform_role fills that gap.

ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS platform_role TEXT;

ALTER TABLE profiles
    DROP CONSTRAINT IF EXISTS profiles_platform_role_check;

ALTER TABLE profiles
    ADD CONSTRAINT profiles_platform_role_check
    CHECK (platform_role IS NULL OR platform_role IN ('super_admin'));

-- ============================================================
-- 3. DOCUMENTS.UPDATED_AT
-- ============================================================
-- document.repository.ts maps row.updated_at.toISOString(); without the
-- column every document read threw a TypeError on undefined.

ALTER TABLE documents
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DROP TRIGGER IF EXISTS documents_set_updated_at ON documents;
CREATE TRIGGER documents_set_updated_at
BEFORE UPDATE ON documents
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 4. REBUILD THE RLS POLICIES THAT REFERENCED THE DEAD ALIAS
-- ============================================================

DROP POLICY IF EXISTS verifications_select_reviewer ON verifications;
CREATE POLICY verifications_select_reviewer ON verifications
FOR SELECT USING (
    EXISTS (
        SELECT 1
        FROM organization_members om
        WHERE om.user_id = app_current_user_id()
          AND om.role IN ('compliance_officer', 'org_admin')
    )
);

DROP POLICY IF EXISTS deposits_select_org_officer ON deposits;
CREATE POLICY deposits_select_org_officer ON deposits
FOR SELECT USING (
    EXISTS (
        SELECT 1
        FROM auctions a
        JOIN organization_members om ON om.organization_id = a.org_id
        WHERE a.id = deposits.auction_id
          AND om.user_id = app_current_user_id()
          AND om.role IN ('auction_officer', 'org_admin', 'compliance_officer')
    )
);

-- ============================================================
-- 5. AUCTION LIFECYCLE BOOKKEEPING
-- ============================================================
-- The scheduler opens and closes auctions automatically; these columns let
-- a report explain *why* an auction is in its current state.

ALTER TABLE auctions
    ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
    ADD COLUMN IF NOT EXISTS awarded_at TIMESTAMPTZ;

-- Drives the scheduler's "which auctions are due?" sweep.
CREATE INDEX IF NOT EXISTS idx_auctions_status_opens_at
    ON auctions (status, opens_at);

CREATE INDEX IF NOT EXISTS idx_auctions_status_closes_at
    ON auctions (status, closes_at);

COMMENT ON COLUMN profiles.platform_role
    IS 'Platform-wide role held outside any organization. Currently only super_admin.';
