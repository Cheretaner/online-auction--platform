ALTER TABLE autofetch_sources
    DROP CONSTRAINT IF EXISTS autofetch_sources_last_fetch_status_check,
    DROP COLUMN IF EXISTS last_fetch_error,
    DROP COLUMN IF EXISTS last_fetch_summary,
    DROP COLUMN IF EXISTS last_fetch_status,
    DROP COLUMN IF EXISTS last_fetch_attempt_at;
