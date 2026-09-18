DROP POLICY IF EXISTS compliance_checks_select_officers ON compliance_checks;
DROP POLICY IF EXISTS anomaly_flags_select_org_admin ON anomaly_flags;
DROP POLICY IF EXISTS disputes_select_org_admin ON disputes;

ALTER TABLE outbox_messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE idempotency_keys DISABLE ROW LEVEL SECURITY;

DROP INDEX IF EXISTS uq_disputes_open_raiser;
DROP INDEX IF EXISTS uq_bids_sealed_active_bidder;
DROP INDEX IF EXISTS idx_auction_reports_type;

ALTER TABLE auction_reports DROP CONSTRAINT IF EXISTS auction_reports_type_check;
ALTER TABLE auction_reports DROP COLUMN IF EXISTS report_type;
