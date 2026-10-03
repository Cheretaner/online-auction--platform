ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS telegram_language TEXT NOT NULL DEFAULT 'en'
    CHECK (telegram_language IN ('en', 'am'));
