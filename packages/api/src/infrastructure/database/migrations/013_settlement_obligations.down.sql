DROP INDEX IF EXISTS provider_transactions_settlement_created_idx;
ALTER TABLE provider_transactions DROP CONSTRAINT IF EXISTS provider_transactions_subject_check;
ALTER TABLE provider_transactions DROP COLUMN IF EXISTS settlement_id;
ALTER TABLE provider_transactions ALTER COLUMN deposit_id SET NOT NULL;

DROP INDEX IF EXISTS settlement_obligations_winner_status_idx;
DROP TABLE IF EXISTS settlement_obligations;