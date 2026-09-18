BEGIN;

DELETE FROM categories
WHERE slug IN ('vehicles', 'property', 'machinery', 'electronics', 'general');

DROP INDEX IF EXISTS idx_anomaly_flags_auction_status;
DROP INDEX IF EXISTS idx_auction_reports_auction;
DROP INDEX IF EXISTS idx_disputes_raised_by;

DROP POLICY IF EXISTS verifications_select_compliance ON verifications;
CREATE POLICY verifications_select_compliance
ON verifications
FOR SELECT
USING (
    EXISTS (
        SELECT 1
        FROM organization_members om
        WHERE om.user_id = verifications.user_id
          AND om.organization_id = app_current_org_id()
          AND om.user_id = app_current_user_id()
          AND om.role = 'compliance_officer'
    )
);

DROP POLICY IF EXISTS bids_select_org_officers ON bids;

DROP INDEX IF EXISTS idx_notifications_dispatch;
ALTER TABLE notifications
    DROP COLUMN IF EXISTS attempt_count,
    DROP COLUMN IF EXISTS next_attempt_at;

DROP POLICY IF EXISTS compliance_checks_select_officers ON compliance_checks;
DROP TABLE IF EXISTS compliance_checks;
DROP TYPE IF EXISTS compliance_check_status;

DROP TABLE IF EXISTS outbox_messages;
DROP TABLE IF EXISTS idempotency_keys;

DROP TRIGGER IF EXISTS audit_events_deny_update ON audit_events;
DROP FUNCTION IF EXISTS deny_audit_mutation();

DROP INDEX IF EXISTS idx_audit_events_entity;
DROP INDEX IF EXISTS idx_audit_events_ledger_sequence;

ALTER TABLE audit_events DROP CONSTRAINT IF EXISTS audit_events_unique_sequence;
ALTER TABLE audit_events DROP COLUMN IF EXISTS ledger_scope;
ALTER TABLE audit_events
    ADD CONSTRAINT audit_events_unique_sequence UNIQUE (auction_id, sequence_no);

ALTER TABLE auctions
    DROP CONSTRAINT IF EXISTS auctions_anti_snipe_non_negative,
    DROP CONSTRAINT IF EXISTS auctions_max_extensions_non_negative,
    DROP COLUMN IF EXISTS anti_snipe_seconds,
    DROP COLUMN IF EXISTS max_extensions,
    DROP COLUMN IF EXISTS sealed_opened_at,
    DROP COLUMN IF EXISTS sealed_opened_by;

COMMIT;
