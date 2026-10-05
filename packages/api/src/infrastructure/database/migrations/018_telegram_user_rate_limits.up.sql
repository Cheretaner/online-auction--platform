CREATE TABLE telegram_user_rate_limits (
    telegram_account_hash CHAR(64) NOT NULL,
    action VARCHAR(32) NOT NULL CHECK (action IN ('bid', 'voice')),
    window_started_at TIMESTAMPTZ NOT NULL,
    hit_count INTEGER NOT NULL CHECK (hit_count > 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (telegram_account_hash, action)
);
