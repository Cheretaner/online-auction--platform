-- 007_performance_indexes.down.sql

DROP INDEX IF EXISTS idx_auctions_org_status;
DROP INDEX IF EXISTS idx_auctions_status_opens;
DROP INDEX IF EXISTS idx_auctions_status_closes;
DROP INDEX IF EXISTS idx_verifications_user_status;
DROP INDEX IF EXISTS idx_deposits_auction_bidder_status;
DROP INDEX IF EXISTS idx_notifications_user_status;
DROP INDEX IF EXISTS idx_audit_events_auction_seq;
DROP INDEX IF EXISTS idx_bids_auction_status;
DROP INDEX IF EXISTS idx_bids_bidder;
DROP INDEX IF EXISTS idx_bids_auction_created;
