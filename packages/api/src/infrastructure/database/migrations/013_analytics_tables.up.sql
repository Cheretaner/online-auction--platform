-- 013_analytics_tables.up.sql
--
-- Tables and indexes for historical analytics and reserve price recommendations

-- Materialized view for auction statistics aggregated by category, region, and time period
-- Refreshed periodically to provide fast analytics queries
CREATE MATERIALIZED VIEW IF NOT EXISTS auction_analytics AS
SELECT 
  COALESCE(a.region, 'unknown') as region,
  COALESCE(ai.category_id, '00000000-0000-0000-0000-000000000000') as category_id,
  DATE_TRUNC('month', a.closed_at) as period,
  COUNT(DISTINCT a.id) as auction_count,
  COUNT(DISTINCT b.bidder_id) as unique_bidders,
  COUNT(b.id) as total_bids,
  AVG(b.amount::numeric) as avg_bid_amount,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY b.amount::numeric) as median_bid_amount,
  AVG(a.winning_amount::numeric) as avg_winning_amount,
  AVG(a.reserve_price::numeric) as avg_reserve_price,
  AVG(CASE WHEN a.winning_amount IS NOT NULL AND a.reserve_price IS NOT NULL 
      THEN (a.winning_amount::numeric / NULLIF(a.reserve_price::numeric, 0)) * 100 
      END) as avg_reserve_to_winning_ratio,
  AVG(a.bid_count) as avg_bids_per_auction,
  COUNT(CASE WHEN a.status = 'awarded' THEN 1 END) as successful_auctions,
  COUNT(CASE WHEN a.status = 'cancelled' THEN 1 END) as cancelled_auctions
FROM auctions a
LEFT JOIN auction_items ai ON ai.auction_id = a.id
LEFT JOIN bids b ON b.auction_id = a.id AND b.status = 'active'
WHERE a.status IN ('closed', 'awarded', 'under_review', 'cancelled')
  AND a.closed_at IS NOT NULL
GROUP BY COALESCE(a.region, 'unknown'), ai.category_id, DATE_TRUNC('month', a.closed_at);

-- Indexes for fast analytics queries
CREATE INDEX IF NOT EXISTS idx_auction_analytics_region_category 
ON auction_analytics(region, category_id);

CREATE INDEX IF NOT EXISTS idx_auction_analytics_period 
ON auction_analytics(period DESC);

CREATE INDEX IF NOT EXISTS idx_auction_analytics_category_period 
ON auction_analytics(category_id, period DESC);

COMMENT ON MATERIALIZED VIEW auction_analytics IS 'Historical auction statistics for analytics and recommendations';

-- Create a refresh function to update analytics (called by scheduled job)
CREATE OR REPLACE FUNCTION refresh_auction_analytics()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY auction_analytics;
END;
$$;

-- Table for storing reserve price recommendations
CREATE TABLE IF NOT EXISTS reserve_price_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id UUID NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
  category_id UUID,
  region VARCHAR(100),
  estimated_value DECIMAL(15, 2),
  recommended_reserve DECIMAL(15, 2) NOT NULL,
  confidence_score INTEGER NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 100),
  based_on_auctions INTEGER NOT NULL DEFAULT 0,
  calculation_method VARCHAR(50) NOT NULL,
  factors JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  CONSTRAINT unique_auction_recommendation UNIQUE(auction_id)
);

CREATE INDEX IF NOT EXISTS idx_reserve_recommendations_auction 
ON reserve_price_recommendations(auction_id);

CREATE INDEX IF NOT EXISTS idx_reserve_recommendations_category 
ON reserve_price_recommendations(category_id);

COMMENT ON TABLE reserve_price_recommendations IS 'AI-generated reserve price recommendations based on historical data';

-- Table for tracking participation metrics
CREATE TABLE IF NOT EXISTS bidder_participation_metrics (
  bidder_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  period DATE NOT NULL, -- Monthly aggregation
  auctions_participated INTEGER NOT NULL DEFAULT 0,
  total_bids_placed INTEGER NOT NULL DEFAULT 0,
  auctions_won INTEGER NOT NULL DEFAULT 0,
  total_spent DECIMAL(15, 2) NOT NULL DEFAULT 0,
  avg_bid_amount DECIMAL(15, 2),
  win_rate DECIMAL(5, 2), -- Percentage
  categories_active TEXT[], -- Array of category IDs
  regions_active TEXT[], -- Array of regions
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (bidder_id, period)
);

CREATE INDEX IF NOT EXISTS idx_bidder_metrics_period 
ON bidder_participation_metrics(period DESC);

CREATE INDEX IF NOT EXISTS idx_bidder_metrics_win_rate 
ON bidder_participation_metrics(win_rate DESC NULLS LAST);

COMMENT ON TABLE bidder_participation_metrics IS 'Historical participation metrics for bidders aggregated by month';
