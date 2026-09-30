-- Reverses 005_role_alignment.up.sql.

DROP INDEX IF EXISTS idx_auctions_status_closes_at;
DROP INDEX IF EXISTS idx_auctions_status_opens_at;

ALTER TABLE auctions
    DROP COLUMN IF EXISTS awarded_at,
    DROP COLUMN IF EXISTS cancellation_reason,
    DROP COLUMN IF EXISTS closed_at;

DROP POLICY IF EXISTS deposits_select_org_officer ON deposits;
DROP POLICY IF EXISTS verifications_select_reviewer ON verifications;

DROP TRIGGER IF EXISTS documents_set_updated_at ON documents;
ALTER TABLE documents DROP COLUMN IF EXISTS updated_at;

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_platform_role_check;
ALTER TABLE profiles DROP COLUMN IF EXISTS platform_role;

DROP INDEX IF EXISTS idx_organization_members_user;

ALTER TABLE organization_members
    DROP CONSTRAINT IF EXISTS organization_members_role_check;
ALTER TABLE organization_members
    ADD CONSTRAINT organization_members_role_check
    CHECK (role IN ('org_admin', 'auction_officer', 'compliance_officer'));
