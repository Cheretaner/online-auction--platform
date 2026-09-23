-- 008_autofetch_tables.up.sql
-- Auto-fetch + verification pipeline
-- Tracks data sources, pending items for review, detected conflicts, and admin actions

-- 1. Source configuration table
-- Stores external data sources (APIs, scrapers, CSV feeds, etc.)
-- Officers create sources, system auto-fetches periodically
CREATE TABLE IF NOT EXISTS autofetch_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    adapter_type VARCHAR(50) NOT NULL,
    -- adapter_type examples: 'json-feed', 'csv-upload', 'web-scraper', 'api-feed'
    source_url TEXT,
    -- Source-specific configuration (API keys, selectors, auth, etc.)
    config JSONB,
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_fetched_at TIMESTAMPTZ,
    next_fetch_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_autofetch_sources_org ON autofetch_sources (organization_id);
CREATE INDEX IF NOT EXISTS idx_autofetch_sources_active ON autofetch_sources (is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_autofetch_sources_next_fetch ON autofetch_sources (next_fetch_at) WHERE is_active = true;

-- 2. Pending items queue
-- Items fetched from external sources, awaiting review before publication
CREATE TABLE IF NOT EXISTS autofetch_pending_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID NOT NULL REFERENCES autofetch_sources(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    external_id VARCHAR(500),
    -- Match fields for deduplication: (source_id, external_id) is unique within org
    title VARCHAR(500) NOT NULL,
    description TEXT,
    -- Original data from source (for audit/retroactive analysis)
    raw_metadata JSONB NOT NULL,
    -- Normalized to our internal model
    normalized_metadata JSONB NOT NULL,
    -- AI confidence in the normalization (0-100)
    ai_confidence INT CHECK (ai_confidence >= 0 AND ai_confidence <= 100),
    estimated_value NUMERIC(14, 2),
    category_suggestion VARCHAR(255),
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    -- Statuses: pending, approved, rejected, published, expired
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_autofetch_pending_source_status ON autofetch_pending_items (source_id, status);
CREATE INDEX IF NOT EXISTS idx_autofetch_pending_org_status ON autofetch_pending_items (organization_id, status);
CREATE INDEX IF NOT EXISTS idx_autofetch_pending_created ON autofetch_pending_items (created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_autofetch_pending_external_id ON autofetch_pending_items (source_id, external_id) WHERE status IN ('pending', 'approved');

-- 2a. Automatic expiry: items older than 60 days in 'pending' state are marked 'expired'
-- Scheduler job runs daily to clean up

-- 3. Conflict flags
-- Detected conflicts between pending items and existing auctions
CREATE TABLE IF NOT EXISTS autofetch_conflicts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pending_item_id UUID NOT NULL REFERENCES autofetch_pending_items(id) ON DELETE CASCADE,
    conflicting_auction_id UUID REFERENCES auctions(id) ON DELETE SET NULL,
    -- Conflict types: 'duplicate', 'overlap', 'category_conflict', 'temporal_conflict'
    conflict_type VARCHAR(50) NOT NULL,
    -- Severity: CRITICAL (definite duplicate), HIGH, MEDIUM, LOW, NONE
    severity VARCHAR(20) NOT NULL,
    CHECK (severity IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'NONE')),
    -- Confidence score 0-100 (higher = more confident it's a conflict)
    confidence_score INT CHECK (confidence_score >= 0 AND confidence_score <= 100),
    -- Details of what matched: title, SKU, location, date, value, category
    match_details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_autofetch_conflicts_pending ON autofetch_conflicts (pending_item_id);
CREATE INDEX IF NOT EXISTS idx_autofetch_conflicts_auction ON autofetch_conflicts (conflicting_auction_id);
CREATE INDEX IF NOT EXISTS idx_autofetch_conflicts_severity ON autofetch_conflicts (severity DESC);

-- 4. Admin review actions
-- Tracks who approved/rejected items and why
CREATE TABLE IF NOT EXISTS autofetch_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pending_item_id UUID NOT NULL REFERENCES autofetch_pending_items(id) ON DELETE CASCADE,
    reviewed_by_id UUID NOT NULL REFERENCES identities(id),
    action VARCHAR(50) NOT NULL,
    -- Actions: approve, reject, flag_for_manual_review
    CHECK (action IN ('approve', 'reject', 'flag_for_manual_review')),
    notes TEXT,
    reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_autofetch_reviews_pending ON autofetch_reviews (pending_item_id);
CREATE INDEX IF NOT EXISTS idx_autofetch_reviews_reviewer ON autofetch_reviews (reviewed_by_id);
CREATE INDEX IF NOT EXISTS idx_autofetch_reviews_action ON autofetch_reviews (action);

-- 5. Unique constraint: only one review per pending item (the most recent one)
ALTER TABLE autofetch_reviews
ADD CONSTRAINT unique_latest_review_per_item UNIQUE (pending_item_id);

-- 6. Comments / audit trail for pending item changes
-- Logs fetch attempts, conflicts detected, state transitions
CREATE TABLE IF NOT EXISTS autofetch_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pending_item_id UUID REFERENCES autofetch_pending_items(id) ON DELETE SET NULL,
    source_id UUID REFERENCES autofetch_sources(id) ON DELETE SET NULL,
    event_type VARCHAR(100) NOT NULL,
    -- Examples: 'fetched', 'conflict_detected', 'approved', 'rejected', 'error'
    event_data JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_autofetch_audit_pending ON autofetch_audit (pending_item_id);
CREATE INDEX IF NOT EXISTS idx_autofetch_audit_source ON autofetch_audit (source_id);
CREATE INDEX IF NOT EXISTS idx_autofetch_audit_event_type ON autofetch_audit (event_type);
CREATE INDEX IF NOT EXISTS idx_autofetch_audit_created ON autofetch_audit (created_at DESC);
