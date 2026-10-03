-- Supports organization scoped anomaly history lookups by shared subject account.
CREATE INDEX IF NOT EXISTS idx_anomaly_flags_subject_accounts_gin
    ON anomaly_flags USING GIN (subject_accounts);

CREATE INDEX IF NOT EXISTS idx_anomaly_flags_created_at
    ON anomaly_flags (created_at DESC);
