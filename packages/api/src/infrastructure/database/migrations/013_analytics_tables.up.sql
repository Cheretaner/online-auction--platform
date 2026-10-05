-- 013_analytics_tables.up.sql
--
-- Tables and indexes for historical analytics and reserve price recommendations

-- Materialized view for auction statistics aggregated by category, region, and time period
-- Refreshed periodically to provide fast analytics queries
CREATE MATERIALIZED VIEW IF NOT EXISTS auction_analytics AS
WITH auction_categories AS (
  SELECT DISTINCT auction_id, category_id FROM auction_items
),
auction_base AS (
  SELECT a.id,
         COALESCE(a.region, 'unknown') AS region,
         COALESCE(ac.category_id::text, '00000000-0000-0000-0000-000000000000') AS category_id,
         DATE_TRUNC('month', a.closed_at) AS period,
         a.winning_amount::numeric AS winning_amount,
         a.reserve_price::numeric AS reserve_price,
         a.bid_count,
         a.status
    FROM auctions a
    LEFT JOIN auction_categories ac ON ac.auction_id = a.id
   WHERE a.status IN ('closed', 'awarded', 'under_review', 'cancelled')
     AND a.closed_at IS NOT NULL
),
auction_metrics AS (
  SELECT region, category_id, period,
         COUNT(*) AS auction_count,
         AVG(winning_amount) AS avg_winning_amount,
         AVG(reserve_price) AS avg_reserve_price,
         AVG(CASE WHEN winning_amount IS NOT NULL AND reserve_price IS NOT NULL
                  THEN winning_amount / NULLIF(reserve_price, 0) * 100 END) AS avg_reserve_to_winning_ratio,
         AVG(bid_count) AS avg_bids_per_auction,
         COUNT(*) FILTER (WHERE status = 'awarded') AS successful_auctions,
         COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled_auctions
    FROM auction_base
   GROUP BY region, category_id, period
),
bid_metrics AS (
  SELECT ab.region, ab.category_id, ab.period,
         COUNT(DISTINCT b.bidder_id) AS unique_bidders,
         COUNT(b.id) AS total_bids,
         AVG(b.amount::numeric) AS avg_bid_amount,
         PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY b.amount::numeric) AS median_bid_amount
    FROM auction_base ab
    LEFT JOIN bids b ON b.auction_id = ab.id AND b.status = 'active'
   GROUP BY ab.region, ab.category_id, ab.period
)
SELECT a.region, a.category_id, a.period, a.auction_count,
       COALESCE(b.unique_bidders, 0) AS unique_bidders,
       COALESCE(b.total_bids, 0) AS total_bids,
       b.avg_bid_amount, b.median_bid_amount,
       a.avg_winning_amount, a.avg_reserve_price, a.avg_reserve_to_winning_ratio,
       a.avg_bids_per_auction, a.successful_auctions, a.cancelled_auctions
  FROM auction_metrics a
  JOIN bid_metrics b USING (region, category_id, period);

-- Indexes for fast analytics queries
CREATE INDEX IF NOT EXISTS idx_auction_analytics_region_category 
ON auction_analytics(region, category_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_auction_analytics_unique
ON auction_analytics(region, category_id, period);

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
