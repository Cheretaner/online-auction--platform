-- Hardening pass: report taxonomy, sealed-bid uniqueness,
-- dispute uniqueness, and officer read access that 003 missed.

ALTER TABLE auction_reports
    ADD COLUMN IF NOT EXISTS report_type TEXT NOT NULL DEFAULT 'auction_summary';

ALTER TABLE auction_reports
    DROP CONSTRAINT IF EXISTS auction_reports_type_check;
ALTER TABLE auction_reports
    ADD CONSTRAINT auction_reports_type_check
    CHECK (report_type IN ('auction_summary', 'compliance', 'audit_trail'));

CREATE INDEX IF NOT EXISTS idx_auction_reports_type
    ON auction_reports (auction_id, report_type, generated_at DESC);

-- One live sealed bid per bidder; open auctions may supersede.
CREATE UNIQUE INDEX IF NOT EXISTS uq_bids_sealed_active_bidder
    ON bids (auction_id, bidder_id)
    WHERE is_sealed = TRUE AND status = 'active';

-- One unresolved dispute per raiser per auction.
CREATE UNIQUE INDEX IF NOT EXISTS uq_disputes_open_raiser
    ON disputes (auction_id, raised_by)
    WHERE status IN ('open', 'under_review');

DROP POLICY IF EXISTS disputes_select_org_admin ON disputes;
CREATE POLICY disputes_select_org_admin
ON disputes
FOR SELECT
USING (
    EXISTS (
        SELECT 1
        FROM auctions a
        JOIN organization_members om
          ON om.organization_id = a.org_id
        WHERE a.id = disputes.auction_id
          AND a.org_id = app_current_org_id()
          AND om.user_id = app_current_user_id()
          AND om.role IN ('org_admin', 'auction_officer')
    )
);

DROP POLICY IF EXISTS anomaly_flags_select_org_admin ON anomaly_flags;
CREATE POLICY anomaly_flags_select_org_admin
ON anomaly_flags
FOR SELECT
USING (
    EXISTS (
        SELECT 1
        FROM auctions a
        JOIN organization_members om
          ON om.organization_id = a.org_id
        WHERE a.id = anomaly_flags.auction_id
          AND a.org_id = app_current_org_id()
          AND om.user_id = app_current_user_id()
          AND om.role IN ('org_admin', 'auction_officer')
    )
);

-- Outbox and idempotency are infrastructure tables, not tenant-readable.
ALTER TABLE outbox_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE idempotency_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_checks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS compliance_checks_select_officers ON compliance_checks;
CREATE POLICY compliance_checks_select_officers
ON compliance_checks
FOR SELECT
USING (
    EXISTS (
        SELECT 1
        FROM auctions a
        JOIN organization_members om
          ON om.organization_id = a.org_id
        WHERE a.id = compliance_checks.auction_id
          AND a.org_id = app_current_org_id()
          AND om.user_id = app_current_user_id()
          AND om.role IN ('compliance_officer', 'org_admin', 'auction_officer')
    )
);
