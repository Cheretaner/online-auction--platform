-- 008_autofetch_tables.down.sql
-- Rollback auto-fetch + verification pipeline tables

-- Drop in reverse order of creation (respect foreign key constraints)
DROP TABLE IF EXISTS autofetch_audit;
DROP TABLE IF EXISTS autofetch_reviews;
DROP TABLE IF EXISTS autofetch_conflicts;
DROP TABLE IF EXISTS autofetch_pending_items;
DROP TABLE IF EXISTS autofetch_sources;
