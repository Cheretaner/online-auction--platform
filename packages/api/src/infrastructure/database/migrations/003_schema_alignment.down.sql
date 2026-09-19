-- 003_schema_alignment.down.sql
-- Reverts all changes from 003_schema_alignment.up.sql
--
-- NOTE: No BEGIN/COMMIT — the migration runner handles transactions.

-- ============================================================
-- 8. REVERT PUBLIC-FACING RLS POLICIES
-- ============================================================

DROP POLICY IF EXISTS deposits_select_org_officer ON deposits;
DROP POLICY IF EXISTS documents_select_public ON documents;
DROP POLICY IF EXISTS organizations_select_active ON organizations;
DROP POLICY IF EXISTS auction_items_select_public ON auction_items;
DROP POLICY IF EXISTS auctions_select_public ON auctions;


-- ============================================================
-- 7. REVERT RLS POLICY FIX — restore original (buggy) policy
-- ============================================================

DROP POLICY IF EXISTS verifications_select_reviewer ON verifications;

CREATE POLICY verifications_select_compliance ON verifications
FOR SELECT USING (
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
-- 6. REVERT DEPOSITS
-- ============================================================

ALTER TABLE deposits DROP CONSTRAINT IF EXISTS deposits_instrument_type_check;
ALTER TABLE deposits DROP COLUMN IF EXISTS instrument_type;


-- ============================================================
-- 5. REVERT DOCUMENTS
-- ============================================================

ALTER TABLE documents DROP COLUMN IF EXISTS summary;


-- ============================================================
-- 4. REVERT AUCTION_ITEMS
-- ============================================================

ALTER TABLE auction_items DROP CONSTRAINT IF EXISTS auction_items_category_source_check;
ALTER TABLE auction_items DROP CONSTRAINT IF EXISTS auction_items_condition_check;
ALTER TABLE auction_items DROP COLUMN IF EXISTS category_source;
ALTER TABLE auction_items DROP COLUMN IF EXISTS ai_model;
ALTER TABLE auction_items DROP COLUMN IF EXISTS condition;


-- ============================================================
-- 3. REVERT AUCTIONS
-- ============================================================

ALTER TABLE auctions DROP COLUMN IF EXISTS region;
ALTER TABLE auctions DROP COLUMN IF EXISTS eligibility_rules;


-- ============================================================
-- 2. REVERT ORGANIZATIONS
-- ============================================================

ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_org_type_check;
ALTER TABLE organizations DROP COLUMN IF EXISTS onboarded_by;
ALTER TABLE organizations DROP COLUMN IF EXISTS logo_url;
ALTER TABLE organizations DROP COLUMN IF EXISTS contact_phone;
ALTER TABLE organizations DROP COLUMN IF EXISTS contact_email;
ALTER TABLE organizations DROP COLUMN IF EXISTS region;
ALTER TABLE organizations DROP COLUMN IF EXISTS org_type;


-- ============================================================
-- 1. REVERT PROFILES
-- ============================================================

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_account_type_check;
ALTER TABLE profiles DROP COLUMN IF EXISTS is_active;
ALTER TABLE profiles DROP COLUMN IF EXISTS region;
ALTER TABLE profiles DROP COLUMN IF EXISTS tin_number;
ALTER TABLE profiles DROP COLUMN IF EXISTS national_id;
ALTER TABLE profiles DROP COLUMN IF EXISTS business_name;
ALTER TABLE profiles DROP COLUMN IF EXISTS account_type;
ALTER TABLE profiles DROP COLUMN IF EXISTS phone;
ALTER TABLE profiles DROP COLUMN IF EXISTS password_hash;

ALTER TABLE profiles ALTER COLUMN id DROP DEFAULT;
ALTER TABLE profiles RENAME COLUMN full_name TO display_name;
