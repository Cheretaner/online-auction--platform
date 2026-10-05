CREATE TABLE auction_watchlists (
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    auction_id UUID NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
    channel notification_channel NOT NULL,
    alert_on_bids BOOLEAN NOT NULL DEFAULT FALSE,
    alert_on_status BOOLEAN NOT NULL DEFAULT TRUE,
    last_bid_alert_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, auction_id, channel),
    CONSTRAINT auction_watchlists_has_alert CHECK (alert_on_bids OR alert_on_status)
);

CREATE INDEX auction_watchlists_auction_idx ON auction_watchlists (auction_id);
CREATE INDEX auction_watchlists_user_idx ON auction_watchlists (user_id, created_at DESC);

CREATE TABLE auction_watchlist_deliveries (
    outbox_id UUID NOT NULL REFERENCES outbox_messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    channel notification_channel NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (outbox_id, user_id, channel)
);

CREATE TRIGGER auction_watchlists_set_updated_at
BEFORE UPDATE ON auction_watchlists
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
