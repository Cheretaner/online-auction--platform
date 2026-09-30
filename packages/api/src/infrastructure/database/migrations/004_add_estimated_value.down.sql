-- 004_add_estimated_value.down.sql
-- Reverts 004_add_estimated_value.up.sql
--
-- NOTE: No BEGIN/COMMIT — the migration runner handles transactions.

ALTER TABLE auction_items
    DROP CONSTRAINT IF EXISTS auction_items_estimated_value_non_negative;

ALTER TABLE auction_items
    DROP COLUMN IF EXISTS estimated_value;
