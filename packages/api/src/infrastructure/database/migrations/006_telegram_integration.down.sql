-- 006_telegram_integration.down.sql

DROP TABLE IF EXISTS telegram_channel_posts;
DROP TABLE IF EXISTS telegram_link_tokens;

DROP INDEX IF EXISTS idx_profiles_telegram_chat_id;
DROP INDEX IF EXISTS idx_profiles_telegram_id;

ALTER TABLE profiles
    DROP COLUMN IF EXISTS telegram_linked_at,
    DROP COLUMN IF EXISTS telegram_chat_id,
    DROP COLUMN IF EXISTS telegram_username,
    DROP COLUMN IF EXISTS telegram_id;
