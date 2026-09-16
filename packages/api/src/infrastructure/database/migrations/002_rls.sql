ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE auctions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;

-- Policies are placeholders; wire app.current_user_id / app.current_org_id in production.
CREATE POLICY org_member_read ON organization_members
  FOR SELECT USING (TRUE);

CREATE POLICY auction_org_read ON auctions
  FOR SELECT USING (TRUE);

CREATE POLICY bid_read ON bids
  FOR SELECT USING (TRUE);
