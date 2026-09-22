-- 007_performance_indexes.up.sql
-- High-impact performance indexes for fast bidding lookups, scheduler lifecycle sweeps,
-- and low-latency audit chain verification.

-- 1. Bids indexing
CREATE INDEX IF NOT EXISTS idx_bids_auction_created
    ON bids (auction_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bids_bidder
    ON bids (bidder_id);

CREATE INDEX IF NOT EXISTS idx_bids_auction_status
    ON bids (auction_id, status);

-- 2. Audit ledger indexing for chain traversal
CREATE INDEX IF NOT EXISTS idx_audit_events_auction_seq
    ON audit_events (auction_id, sequence_no ASC);

-- 3. Notifications feed indexing for fast unread count
CREATE INDEX IF NOT EXISTS idx_notifications_user_status
    ON notifications (user_id, status, created_at DESC);

-- 4. Deposits indexing for bid qualification checks
CREATE INDEX IF NOT EXISTS idx_deposits_auction_bidder_status
    ON deposits (auction_id, bidder_id, status);

-- 5. KYC verifications indexing
CREATE INDEX IF NOT EXISTS idx_verifications_user_status
    ON verifications (user_id, status);

-- 6. Auctions lifecycle and scheduler querying
CREATE INDEX IF NOT EXISTS idx_auctions_status_closes
    ON auctions (status, closes_at);

CREATE INDEX IF NOT EXISTS idx_auctions_status_opens
    ON auctions (status, opens_at);

CREATE INDEX IF NOT EXISTS idx_auctions_org_status
    ON auctions (org_id, status);
