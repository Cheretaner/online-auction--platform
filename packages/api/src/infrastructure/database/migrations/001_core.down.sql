BEGIN;
-- 1. DROP TRIGGERS
DROP TRIGGER IF EXISTS organizations_set_updated_at
ON organizations;

DROP TRIGGER IF EXISTS profiles_set_updated_at
ON profiles;

DROP TRIGGER IF EXISTS verifications_set_updated_at
ON verifications;

DROP TRIGGER IF EXISTS categories_set_updated_at
ON categories;

DROP TRIGGER IF EXISTS auctions_set_updated_at
ON auctions;

DROP TRIGGER IF EXISTS auction_items_set_updated_at
ON auction_items;

DROP TRIGGER IF EXISTS deposits_set_updated_at
ON deposits;

DROP TRIGGER IF EXISTS anomaly_flags_set_updated_at
ON anomaly_flags;

DROP TRIGGER IF EXISTS notifications_set_updated_at
ON notifications;

DROP TRIGGER IF EXISTS disputes_set_updated_at
ON disputes;

-- 2. DROP INDEXES
DROP INDEX IF EXISTS uq_verifications_open_user;
DROP INDEX IF EXISTS uq_deposits_auction_bidder;
DROP INDEX IF EXISTS uq_bids_idempotency_key;
DROP INDEX IF EXISTS idx_bids_auction_amount_time;
DROP INDEX IF EXISTS idx_bids_bidder;

DROP INDEX IF EXISTS idx_bids_auction_status;
DROP INDEX IF EXISTS idx_audit_events_auction_sequence;
DROP INDEX IF EXISTS idx_notifications_user_read;
DROP INDEX IF EXISTS idx_disputes_auction;
DROP INDEX IF EXISTS idx_disputes_status;
DROP INDEX IF EXISTS uq_auction_reports_version;


-- 3. DROP TABLES
-- Reverse dependency order.
-- Tables referencing other tables must be removed before
-- the tables they reference.

DROP TABLE IF EXISTS auction_reports;
DROP TABLE IF EXISTS disputes;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS audit_events;
DROP TABLE IF EXISTS anomaly_flags;
DROP TABLE IF EXISTS bids;
DROP TABLE IF EXISTS deposits;
DROP TABLE IF EXISTS documents;
DROP TABLE IF EXISTS auction_items;
DROP TABLE IF EXISTS auctions;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS verifications;
DROP TABLE IF EXISTS organization_members;
DROP TABLE IF EXISTS profiles;
DROP TABLE IF EXISTS organizations;


-- 4. DROP HELPER FUNCTION
DROP FUNCTION IF EXISTS set_updated_at();


-- 5. DROP ENUM TYPES
DROP TYPE IF EXISTS notification_status;
DROP TYPE IF EXISTS notification_channel;
DROP TYPE IF EXISTS dispute_status;
DROP TYPE IF EXISTS anomaly_status;
DROP TYPE IF EXISTS anomaly_severity;
DROP TYPE IF EXISTS bid_status;
DROP TYPE IF EXISTS deposit_status;
DROP TYPE IF EXISTS verification_decision;
DROP TYPE IF EXISTS verification_status;
DROP TYPE IF EXISTS auction_type;
DROP TYPE IF EXISTS auction_status;


-- 6. DO NOT DROP pgcrypto HERE
-- pgcrypto may have been installed before this migration
-- and may be required by other database objects.
--
-- CREATE EXTENSION IF NOT EXISTS "pgcrypto";
-- is therefore intentionally not reversed here.


-- 7. DO NOT DROP schema_migrations HERE
-- ============================================================
-- The migration runner may depend on this table to track
-- migration state.
--
-- Keep it outside the core migration rollback.


COMMIT;