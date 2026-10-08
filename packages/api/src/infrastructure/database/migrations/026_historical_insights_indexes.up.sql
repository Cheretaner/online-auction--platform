CREATE INDEX IF NOT EXISTS idx_auctions_historical_insights
    ON auctions (org_id, auction_type, closed_at)
    WHERE status IN ('closed', 'awarded', 'cancelled');

CREATE INDEX IF NOT EXISTS idx_auction_items_auction_category
    ON auction_items (auction_id, category_id)
    WHERE category_id IS NOT NULL;
