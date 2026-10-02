-- 013_analytics_tables.down.sql

DROP TABLE IF EXISTS bidder_participation_metrics;
DROP TABLE IF EXISTS reserve_price_recommendations;
DROP FUNCTION IF EXISTS refresh_auction_analytics();
DROP MATERIALIZED VIEW IF EXISTS auction_analytics;
