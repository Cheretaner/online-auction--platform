ALTER TABLE autofetch_sources
    ADD COLUMN last_fetch_attempt_at TIMESTAMPTZ,
    ADD COLUMN last_fetch_status VARCHAR(16),
    ADD COLUMN last_fetch_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN last_fetch_error TEXT,
    ADD CONSTRAINT autofetch_sources_last_fetch_status_check
      CHECK (last_fetch_status IS NULL OR last_fetch_status IN ('running', 'success', 'failed'));
