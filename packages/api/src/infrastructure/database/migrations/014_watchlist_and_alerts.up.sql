-- 014_watchlist_and_alerts.up.sql
--
-- Watchlist, saved searches, and smart alerts functionality

-- Watchlist: Auctions users want to follow for updates
CREATE TABLE IF NOT EXISTS watchlist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  auction_id UUID NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
  notes TEXT,
  notify_on_bid BOOLEAN NOT NULL DEFAULT true,
  notify_on_status_change BOOLEAN NOT NULL DEFAULT true,
  notify_on_closing_soon BOOLEAN NOT NULL DEFAULT true, -- 24h before close
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_watchlist_item UNIQUE(user_id, auction_id)
);

CREATE INDEX IF NOT EXISTS idx_watchlist_user ON watchlist_items(user_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_auction ON watchlist_items(auction_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_created ON watchlist_items(created_at DESC);

COMMENT ON TABLE watchlist_items IS 'User watchlist for tracking specific auctions';

-- Saved searches: Custom search queries with alert triggers
CREATE TABLE IF NOT EXISTS saved_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  search_criteria JSONB NOT NULL, -- {categoryId, region, minValue, maxValue, keywords, etc.}
  is_active BOOLEAN NOT NULL DEFAULT true,
  notify_on_match BOOLEAN NOT NULL DEFAULT true,
  last_checked_at TIMESTAMPTZ,
  match_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saved_searches_user ON saved_searches(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_searches_active ON saved_searches(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_saved_searches_criteria ON saved_searches USING GIN (search_criteria);

COMMENT ON TABLE saved_searches IS 'User-defined saved searches with alert capabilities';

-- Notification preferences: Per-user, per-event-type channel preferences
CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_type VARCHAR(100) NOT NULL, -- e.g., 'auction.closing_soon', 'bid.outbid', 'search.match'
  channel VARCHAR(20) NOT NULL CHECK (channel IN ('in_app', 'email', 'telegram', 'voice')),
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, event_type, channel)
);

CREATE INDEX IF NOT EXISTS idx_notification_prefs_user ON notification_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_prefs_enabled ON notification_preferences(enabled) WHERE enabled = true;

COMMENT ON TABLE notification_preferences IS 'User notification preferences by event type and channel';

-- Alert trigger types
CREATE TYPE alert_trigger_type AS ENUM (
  'new_auction_match', -- Saved search found new auction
  'watchlist_bid', -- New bid on watched auction
  'watchlist_status_change', -- Status change on watched auction
  'watchlist_closing_soon', -- Watched auction closing in 24h
  'price_threshold', -- Auction price crossed threshold
  'category_new_auction' -- New auction in watched category
);

-- Alert triggers: Log of triggered alerts for saved searches and watchlists
CREATE TABLE IF NOT EXISTS alert_triggers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  trigger_type alert_trigger_type NOT NULL,
  auction_id UUID REFERENCES auctions(id) ON DELETE CASCADE,
  saved_search_id UUID REFERENCES saved_searches(id) ON DELETE CASCADE,
  watchlist_item_id UUID REFERENCES watchlist_items(id) ON DELETE CASCADE,
  notification_id UUID REFERENCES notifications(id) ON DELETE SET NULL,
  trigger_data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alert_triggers_user ON alert_triggers(user_id);
CREATE INDEX IF NOT EXISTS idx_alert_triggers_type ON alert_triggers(trigger_type);
CREATE INDEX IF NOT EXISTS idx_alert_triggers_auction ON alert_triggers(auction_id);
CREATE INDEX IF NOT EXISTS idx_alert_triggers_created ON alert_triggers(created_at DESC);

COMMENT ON TABLE alert_triggers IS 'Log of triggered smart alerts for audit and deduplication';

-- Default notification preferences for new users
-- Insert via application code on user creation, not here
