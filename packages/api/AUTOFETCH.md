# Auto-Fetch + Verification Pipeline

Complete guide to the auto-fetch system: external data source integration, conflict detection, admin review queue, and automation.

## Overview

The auto-fetch pipeline enables officers to discover auction items from external sources (APIs, scrapers, CSV uploads), have them enriched with AI metadata and conflict detection, and submit to an admin review queue before publication.

```
External Source
      ↓
[Adapter Framework]
      ↓
[Fetch & Normalize]
      ↓
[AI Confidence Scoring]
      ↓
[Conflict Detection Engine]
      ↓
[Pending Review Queue]
      ↓
[Admin Approval/Rejection]
      ↓
[Create AuctionItem / Archive]
```

## Architecture

### Components

1. **Adapter Framework** (`adapters/`)
   - `ISourceAdapter` interface: 6 required methods (fetchItems, normalize, scoreConfidence, isStale, validateConfig, healthCheck)
   - `AdapterRegistry`: Runtime discovery and management
   - Built-in adapters: JsonFeedAdapter, CsvUploadAdapter
   - Extensible: Add new adapters by implementing interface

2. **Conflict Detection** (`conflict/`)
   - `ConflictDetectionService`: Orchestrator
   - 7 matchers: title similarity (Levenshtein), SKU, location, temporal overlap, value proximity, category, quantity
   - Weighted scoring (25% title, 35% SKU, 15% location, 10% temporal, 10% value, 3% category, 2% quantity)
   - Severity levels: CRITICAL (>90), HIGH (70-90), MEDIUM (50-70), LOW (20-50), NONE (<20)

3. **Service Layer** (`autofetch.service.ts`)
   - `AutoFetchService`: Main orchestrator
   - Pipeline: fetch → normalize → score confidence → detect conflicts → queue
   - Methods: fetchAndQueue, approveAndPublish, reject, getPendingQueue, getConflictFlags, createSource, maintenance

4. **Database Schema** (`008_autofetch_tables.up.sql`)
   - `autofetch_sources`: 3 indexes
   - `autofetch_pending_items`: 4 indexes + unique dedup
   - `autofetch_conflicts`: 3 indexes
   - `autofetch_reviews`: 3 indexes + unique latest review
   - `autofetch_audit`: 4 indexes

5. **REST API** (`autofetch.routes.ts`)
   - 9 endpoints for sources, pending queue, conflicts, approval/rejection
   - Role-based: org_admin, compliance_officer, auction_officer
   - Pagination: limit (max 500), offset
   - Filtering: status, sourceId, severityMin

6. **Scheduler** (`autofetch.scheduler.ts`)
   - Hourly refetch job: fetches from sources due for refetch
   - Daily maintenance job: expires old pending items (60+ days)

7. **Telegram Integration** (`autofetch.telegram.ts`)
   - Notifications for fetch completion, conflicts, approvals, rejections
   - HTML-formatted messages with severity indicators

## API Reference

### Sources

**GET /api/v1/autofetch/sources**
List all sources for organization.
```bash
curl -H "Authorization: Bearer $TOKEN" \
  https://api.example.com/api/v1/autofetch/sources
```

**POST /api/v1/autofetch/sources**
Create new data source.
```bash
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Weekly Auction Feed",
    "adapterType": "json-feed",
    "sourceUrl": "https://api.example.com/auctions",
    "adapterConfig": {
      "itemsPath": "data.auctions",
      "mappings": {
        "title": "lot_name",
        "estimatedValue": "estimate"
      }
    }
  }' \
  https://api.example.com/api/v1/autofetch/sources
```

**POST /api/v1/autofetch/sources/:sourceId/fetch**
Manually trigger fetch from source.
```bash
curl -X POST -H "Authorization: Bearer $TOKEN" \
  https://api.example.com/api/v1/autofetch/sources/{sourceId}/fetch
```

### Pending Queue

**GET /api/v1/autofetch/pending?limit=50&offset=0&status=pending**
List pending items (paginated, filterable).

**GET /api/v1/autofetch/pending/:pendingItemId/conflicts**
Get conflicts for a pending item with summary.

**POST /api/v1/autofetch/pending/:pendingItemId/approve**
Approve item for publication.
```json
{
  "auctionId": "auction-uuid"
}
```

**POST /api/v1/autofetch/pending/:pendingItemId/reject**
Reject item with reason.
```json
{
  "reason": "Missing critical information"
}
```

**GET /api/v1/autofetch/stats**
Organization-wide conflict statistics.

## Adapter Development

To add a new adapter (e.g., web scraper, government API):

1. Create file `packages/api/src/autofetch/adapters/my-source.adapter.ts`
2. Implement `ISourceAdapter` interface
3. Register in `registerBuiltInAdapters()` function
4. See `adapters/README.md` for full example

## Conflict Detection Algorithm

### Matchers

| Matcher | Score | Details |
|---------|-------|---------|
| Title Similarity | 0-100 | Levenshtein distance >= 80% |
| SKU/External ID | 0-100 | Exact match (definitive) |
| Location | 0-100 | Region + city match |
| Temporal Overlap | 0-100 | Auction start within 7 days |
| Value Proximity | 0-100 | Price within 10-50% range |
| Category | 0-60 | Category name match |
| Quantity | 0-85 | Quantity similarity |

### Weighted Scoring

```
Overall Score = (
  titleScore * 0.25 +
  skuScore * 0.35 +
  locationScore * 0.15 +
  temporalScore * 0.10 +
  valueScore * 0.10 +
  categoryScore * 0.03 +
  quantityScore * 0.02
)
```

### Severity Determination

- **CRITICAL**: SKU match OR (title + location + temporal all match AND score >= 80)
- **HIGH**: Score >= 70 AND (title AND location match)
- **MEDIUM**: Score 50-70
- **LOW**: Score 20-50
- **NONE**: Score < 20

## Database Schema

### autofetch_sources
Tracks external data source configurations.

| Column | Type | Details |
|--------|------|---------|
| id | UUID | Primary key |
| organization_id | UUID | Org that owns source |
| adapter_type | VARCHAR | json-feed, csv-upload, etc. |
| config | JSONB | Adapter-specific configuration |
| is_active | BOOLEAN | Enable/disable source |
| last_fetched_at | TIMESTAMP | When last fetch occurred |
| next_fetch_at | TIMESTAMP | When next scheduled fetch |

### autofetch_pending_items
Fetched items awaiting review.

| Column | Type | Details |
|--------|------|---------|
| id | UUID | Primary key |
| source_id | UUID | Source it came from |
| organization_id | UUID | Org that received it |
| external_id | VARCHAR | ID from external source |
| status | VARCHAR | pending, approved, rejected, published, expired |
| normalized_metadata | JSONB | Internal AuctionItem format |
| ai_confidence | INT | 0-100 score |

### autofetch_conflicts
Detected conflicts between pending items and existing auctions.

| Column | Type | Details |
|--------|------|---------|
| severity | VARCHAR | CRITICAL, HIGH, MEDIUM, LOW, NONE |
| confidence_score | INT | 0-100 |
| match_details | JSONB | Which fields matched |

### autofetch_reviews
Admin approval/rejection actions.

| Column | Type | Details |
|--------|------|---------|
| action | VARCHAR | approve, reject, flag_for_manual_review |
| reviewed_by_id | UUID | Admin who reviewed |

### autofetch_audit
Audit trail of all autofetch events.

| Column | Type | Details |
|--------|------|---------|
| event_type | VARCHAR | fetched, conflict_detected, approved, error |
| event_data | JSONB | Event details |

## Scheduled Jobs

### autofetch-refetch-sources (hourly)
Fetches from all active sources where `next_fetch_at <= NOW()`.
- Updates `last_fetched_at` and `next_fetch_at` after each fetch
- Logs queued items and conflicts
- Graceful error handling per source

### autofetch-maintenance (daily)
Expires old pending items and cleans up stale data.
- Marks pending items older than 60 days as expired
- Can be manually triggered via `triggerMaintenance(pool)`

## Integration Points

### Audit Ledger
All autofetch events logged to `audit` table via `appendAuditEvent`:
- `autofetch:fetched` — Items fetched from source
- `autofetch:conflict_detected` — Conflicts detected
- `autofetch:approved` — Item approved for publication
- `autofetch:rejected` — Item rejected with reason

### Telegram Notifications
Send status updates to team via:
- `notifyFetchCompleted()` — Fetch results
- `notifyPendingQueueStatus()` — Queue summary
- `notifyItemApproved()` — Approval notifications
- `notifyItemRejected()` — Rejection notifications

## Error Handling

### Adapter Errors
- `AdapterError`: Network failures, API errors, fetch timeouts
- Retry logic: up to 3 retries with backoff
- Stale item detection: adapter.isStale() filters incomplete data

### Conflict Detection Errors
- Graceful degradation: errors don't block approval
- Logged to audit trail with details
- Admin can override conflicts

### Database Errors
- Connection pooling with 30s idle timeout
- Transaction-level isolation
- Foreign key constraints ensure referential integrity

## Performance Considerations

### Indexes
- `autofetch_pending_items(source_id, status)` — Fast filtering
- `autofetch_conflicts(pending_item_id, severity)` — Fast lookup
- `autofetch_sources(organization_id, is_active)` — Active sources query

### Pagination
- Max limit: 500 items per page
- Default: 50 items per page
- Offset-based (stateless)

### Candidate Selection
- Queries only active auctions from same org and region
- Limited to 1000 candidates per conflict detection
- Efficient Levenshtein distance with early termination

## Monitoring & Observability

### Logs
All operations logged at INFO/DEBUG/ERROR levels:
- `autofetch:fetch_completed` — Hourly fetch results
- `autofetch:conflict_detected` — Individual conflicts
- `autofetch:approval_error` — Approval failures
- `autofetch:maintenance_completed` — Nightly cleanup

### Metrics (from logs)
- Items fetched per source
- Conflicts detected by severity
- Approval rate (approved / total reviewed)
- Error rate by operation

### Health Checks
- Source reachability: optional `adapter.healthCheck()`
- Database connectivity: pool error handler
- Job execution: interval verification

## Future Extensions

1. **Document OCR** — Extract text from PDF terms and scanned bids
2. **ML Duplicate Detection** — Improve beyond fuzzy matching
3. **Manual Source Editing** — Officers can enrich before approval
4. **Reverse Auctions** — Support inverse price discovery
5. **Multi-Lot Bundles** — Group related items for bulk purchase
6. **Banking Integration** — Auto-verify deposit status
7. **Analytics Export** — Public data API for research

## Troubleshooting

### Source not fetching
- Check `is_active = true` in database
- Verify `next_fetch_at <= NOW()`
- Check adapter config is valid
- Look for errors in logs: `autofetch:refetch_failed`

### Too many conflicts
- Review conflict severity thresholds
- Check if external source has duplicated data
- Consider increasing org-specific threshold

### Pending items not approving
- Verify reviewer has org_admin or compliance_officer role
- Check auctionId exists and belongs to org
- Look for errors in logs: `autofetch:approval_error`

## Support

For issues or questions:
1. Check application logs for errors
2. Review audit trail: `SELECT * FROM autofetch_audit WHERE event_type = 'error'`
3. Run manual fetch: `POST /api/v1/autofetch/sources/{sourceId}/fetch`
4. Review conflicts: `GET /api/v1/autofetch/pending/{itemId}/conflicts`
