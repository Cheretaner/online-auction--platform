DROP POLICY IF EXISTS org_member_read ON organization_members;
DROP POLICY IF EXISTS auction_org_read ON auctions;
DROP POLICY IF EXISTS bid_read ON bids;
DROP POLICY IF EXISTS organizations_isolation ON organizations;
DROP POLICY IF EXISTS organization_members_isolation ON organization_members;
DROP POLICY IF EXISTS auctions_isolation ON auctions;
DROP POLICY IF EXISTS bids_isolation ON bids;
DROP POLICY IF EXISTS deposits_isolation ON deposits;
DROP POLICY IF EXISTS documents_isolation ON documents;
DROP POLICY IF EXISTS audit_events_isolation ON audit_events;

CREATE OR REPLACE FUNCTION app_bypass_rls() RETURNS BOOLEAN AS $$
  SELECT COALESCE(current_setting('app.bypass_rls', true), 'off') = 'on';
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION app_current_org_id() RETURNS TEXT AS $$
  SELECT NULLIF(current_setting('app.current_org_id', true), '');
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION app_current_user_id() RETURNS TEXT AS $$
  SELECT NULLIF(current_setting('app.current_user_id', true), '');
$$ LANGUAGE SQL STABLE;

CREATE POLICY organizations_isolation ON organizations
  USING (app_bypass_rls() OR id::text = app_current_org_id());

CREATE POLICY organization_members_isolation ON organization_members
  USING (
    app_bypass_rls()
    OR organization_id::text = app_current_org_id()
    OR user_id::text = app_current_user_id()
  );

CREATE POLICY auctions_isolation ON auctions
  USING (app_bypass_rls() OR organization_id::text = app_current_org_id());

CREATE POLICY bids_isolation ON bids
  USING (
    app_bypass_rls()
    OR bidder_id::text = app_current_user_id()
    OR EXISTS (
      SELECT 1 FROM auctions a
      WHERE a.id = bids.auction_id
        AND a.organization_id::text = app_current_org_id()
    )
  );

CREATE POLICY deposits_isolation ON deposits
  USING (
    app_bypass_rls()
    OR user_id::text = app_current_user_id()
    OR EXISTS (
      SELECT 1 FROM auctions a
      WHERE a.id = deposits.auction_id
        AND a.organization_id::text = app_current_org_id()
    )
  );

CREATE POLICY documents_isolation ON documents
  USING (app_bypass_rls() OR organization_id::text = app_current_org_id());

CREATE POLICY audit_events_isolation ON audit_events
  USING (
    app_bypass_rls()
    OR organization_id::text = app_current_org_id()
    OR actor_id::text = app_current_user_id()
  );
