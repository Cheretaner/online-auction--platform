-- 004_add_estimated_value.up.sql
-- Adds the estimated_value column to auction_items.
--
-- This column was referenced in auction-item.repository.ts (INSERT and UPDATE)
-- and in the shared CreateAuctionItemRequest / UpdateAuctionItemRequest schemas,
-- but was never added to the database in migrations 001–003.
--
-- estimated_value is optional (nullable) — officers may or may not know the
-- estimated market value of an item at creation time.  The AI categorization
-- service can also populate it later.
--
-- NUMERIC(14,2) matches every other monetary column in this schema
-- (start_price, reserve_price, winning_amount, etc.).
--
-- NOTE: No BEGIN/COMMIT — the migration runner (run.ts) wraps each
-- migration file in its own transaction.

ALTER TABLE auction_items
    ADD COLUMN estimated_value NUMERIC(14,2);

ALTER TABLE auction_items
    ADD CONSTRAINT auction_items_estimated_value_non_negative
        CHECK (estimated_value IS NULL OR estimated_value >= 0);

COMMENT ON COLUMN auction_items.estimated_value
    IS 'Optional officer- or AI-supplied estimate of market value for this item. Uses NUMERIC(14,2) consistent with all other monetary columns.';
