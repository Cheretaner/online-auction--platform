ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS preferred_language TEXT
    CHECK (preferred_language IN ('en', 'am'));

UPDATE profiles
   SET preferred_language = 'am'
 WHERE preferred_language IS NULL AND telegram_language = 'am';
