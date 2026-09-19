-- 003_schema_alignment.up.sql
-- Aligns the database schema with the SRS data dictionary requirements.
-- Fixes the buggy verifications_select_compliance RLS policy.
-- Adds public-facing RLS policies for auction discovery (FR6).
--
-- NOTE: No BEGIN/COMMIT here — the migration runner (run.ts)
-- wraps each migration in its own transaction.

-- ============================================================
-- 1. PROFILES TABLE  (SRS Table 31 — User)
-- ============================================================

-- Rename display_name → full_name to match SRS field "fullName"
ALTER TABLE profiles RENAME COLUMN display_name TO full_name;

-- Self-managed auth: profiles.id must auto-generate UUIDs
-- (001_core left it without DEFAULT because it assumed Supabase Auth
-- would provide external IDs; Decision 1 chose self-managed auth)
ALTER TABLE profiles ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- Self-managed auth: add password storage
-- DEFAULT '!unset' lets the ALTER succeed if rows already exist;
-- DROP DEFAULT immediately after so future INSERTs must provide it.
-- bcrypt.compare will never match '!unset', effectively locking
-- any pre-existing accounts until a password reset.
ALTER TABLE profiles ADD COLUMN password_hash TEXT NOT NULL DEFAULT '!unset';
ALTER TABLE profiles ALTER COLUMN password_hash DROP DEFAULT;

-- SRS-required identity fields
ALTER TABLE profiles ADD COLUMN phone TEXT;
ALTER TABLE profiles ADD COLUMN account_type TEXT NOT NULL DEFAULT 'individual';
ALTER TABLE profiles ADD COLUMN business_name TEXT;
ALTER TABLE profiles ADD COLUMN national_id TEXT;
ALTER TABLE profiles ADD COLUMN tin_number TEXT;
ALTER TABLE profiles ADD COLUMN region TEXT;
ALTER TABLE profiles ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE profiles ADD CONSTRAINT profiles_account_type_check
    CHECK (account_type IN ('individual', 'business'));


-- ============================================================
-- 2. ORGANIZATIONS TABLE  (SRS Table 32)
-- ============================================================

-- org_type: required by SRS and by Zod CreateOrganizationRequest.
-- DEFAULT lets ALTER succeed on existing rows; DROP DEFAULT forces
-- explicit specification on future INSERTs.
ALTER TABLE organizations ADD COLUMN org_type TEXT NOT NULL DEFAULT 'government';
ALTER TABLE organizations ALTER COLUMN org_type DROP DEFAULT;

ALTER TABLE organizations ADD COLUMN region TEXT;
ALTER TABLE organizations ADD COLUMN contact_email TEXT;
ALTER TABLE organizations ADD COLUMN contact_phone TEXT;
ALTER TABLE organizations ADD COLUMN logo_url TEXT;

ALTER TABLE organizations ADD COLUMN onboarded_by UUID
    REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE organizations ADD CONSTRAINT organizations_org_type_check
    CHECK (org_type IN ('government', 'state_enterprise', 'bank', 'private'));


-- ============================================================
-- 3. AUCTIONS TABLE  (SRS Table 33)
-- ============================================================

ALTER TABLE auctions ADD COLUMN eligibility_rules TEXT;
ALTER TABLE auctions ADD COLUMN region TEXT;


-- ============================================================
-- 4. AUCTION_ITEMS TABLE  (SRS Table 34)
-- ============================================================

ALTER TABLE auction_items ADD COLUMN condition TEXT;
ALTER TABLE auction_items ADD COLUMN ai_model TEXT;
ALTER TABLE auction_items ADD COLUMN category_source TEXT NOT NULL DEFAULT 'manual';

ALTER TABLE auction_items ADD CONSTRAINT auction_items_condition_check
    CHECK (
        condition IS NULL
        OR condition IN ('new', 'used_good', 'used_fair', 'salvage', 'unknown')
    );

ALTER TABLE auction_items ADD CONSTRAINT auction_items_category_source_check
    CHECK (category_source IN ('ai_auto', 'ai_confirmed', 'manual'));


-- ============================================================
-- 5. DOCUMENTS TABLE  (SRS Table 38)
-- ============================================================

ALTER TABLE documents ADD COLUMN summary TEXT;


-- ============================================================
-- 6. DEPOSITS TABLE  (SRS Table 37)
-- ============================================================

ALTER TABLE deposits ADD COLUMN instrument_type TEXT NOT NULL DEFAULT 'cpo';
ALTER TABLE deposits ALTER COLUMN instrument_type DROP DEFAULT;

ALTER TABLE deposits ADD CONSTRAINT deposits_instrument_type_check
    CHECK (instrument_type IN ('cpo', 'bank_guarantee', 'transfer'));


-- ============================================================
-- 7. RLS POLICY FIXES
-- ============================================================

-- FIX: The original verifications_select_compliance policy (002)
-- had:  om.user_id = verifications.user_id
--       AND om.user_id = app_current_user_id()
-- which required the verification applicant to BE the compliance
-- officer — so officers could only see their own KYC, not others'.
-- Replace with a policy that lets any compliance officer or
-- organization admin review ALL verifications.
DROP POLICY IF EXISTS verifications_select_compliance ON verifications;

CREATE POLICY verifications_select_reviewer ON verifications
FOR SELECT USING (
    EXISTS (
        SELECT 1
        FROM organization_members om
        WHERE om.user_id = app_current_user_id()
          AND om.role IN ('compliance_officer', 'organization_admin')
    )
);


-- ============================================================
-- 8. PUBLIC-FACING RLS POLICIES  (FR6 — auction discovery)
-- ============================================================

-- Guests and bidders can browse published auctions without auth.
-- The existing auctions_select_org_member policy (002) only lets
-- org members see their own org's auctions.  This adds a second
-- policy that makes published auctions visible to everyone.
-- (PostgreSQL OR-combines multiple SELECT policies on the same table.)
CREATE POLICY auctions_select_public ON auctions
FOR SELECT USING (
    status IN ('scheduled', 'live', 'closed', 'under_review', 'awarded')
);

-- Items of published auctions are publicly visible
CREATE POLICY auction_items_select_public ON auction_items
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM auctions a
        WHERE a.id = auction_items.auction_id
          AND a.status IN ('scheduled', 'live', 'closed', 'under_review', 'awarded')
    )
);

-- Active organizations are visible to everyone (for search/filter UI)
CREATE POLICY organizations_select_active ON organizations
FOR SELECT USING (is_active = TRUE);

-- Public (non-private) documents of published auctions are visible
CREATE POLICY documents_select_public ON documents
FOR SELECT USING (
    is_private = FALSE
    AND auction_id IS NOT NULL
    AND EXISTS (
        SELECT 1 FROM auctions a
        WHERE a.id = documents.auction_id
          AND a.status IN ('scheduled', 'live', 'closed', 'under_review', 'awarded')
    )
);

-- Officers can see deposits for auctions belonging to their org
-- (needed for deposit verification workflow, FR7)
CREATE POLICY deposits_select_org_officer ON deposits
FOR SELECT USING (
    EXISTS (
        SELECT 1
        FROM auctions a
        JOIN organization_members om ON om.organization_id = a.org_id
        WHERE a.id = deposits.auction_id
          AND om.user_id = app_current_user_id()
          AND om.role IN ('auction_officer', 'organization_admin')
    )
);
