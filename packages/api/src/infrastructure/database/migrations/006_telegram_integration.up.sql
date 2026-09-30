-- 006_telegram_integration.up.sql
-- Adds Telegram bot linking, notification channel support, and channel broadcast tracking.

-- 1. Extend notification_channel enum
ALTER TYPE notification_channel ADD VALUE IF NOT EXISTS 'telegram';

-- 2. Add Telegram fields to profiles
ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS telegram_id BIGINT UNIQUE,
    ADD COLUMN IF NOT EXISTS telegram_username TEXT,
    ADD COLUMN IF NOT EXISTS telegram_chat_id BIGINT,
    ADD COLUMN IF NOT EXISTS telegram_linked_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_profiles_telegram_id ON profiles (telegram_id) WHERE telegram_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_telegram_chat_id ON profiles (telegram_chat_id) WHERE telegram_chat_id IS NOT NULL;

-- 3. One-time tokens / deep links to connect Telegram accounts to user profiles
CREATE TABLE IF NOT EXISTS telegram_link_tokens (
    token TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_telegram_link_tokens_expires ON telegram_link_tokens (expires_at);
CREATE INDEX IF NOT EXISTS idx_telegram_link_tokens_user ON telegram_link_tokens (user_id);

-- 4. Track public announcements posted to the official Telegram Channel
CREATE TABLE IF NOT EXISTS telegram_channel_posts (
    auction_id UUID PRIMARY KEY REFERENCES auctions(id) ON DELETE CASCADE,
    channel_id TEXT NOT NULL,
    message_id BIGINT NOT NULL,
    posted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
