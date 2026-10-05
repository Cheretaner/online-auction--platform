-- 014_watchlist_and_alerts.down.sql

DROP TABLE IF EXISTS alert_triggers CASCADE;
DROP TABLE IF EXISTS saved_searches CASCADE;
DROP TABLE IF EXISTS watchlist_items CASCADE;
DROP TABLE IF EXISTS notification_preferences CASCADE;
DROP TYPE IF EXISTS alert_trigger_type CASCADE;
