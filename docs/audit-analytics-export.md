# Internal audit analytics export

Authorized auction, organization, and compliance officers can export a rolling 90-day CSV from the Audit page. The request requires an active organization context and is scoped by the API to that organization's auctions.

The export aggregates counts by UTC day, actor role, entity type, and action. It deliberately excludes actor/account IDs, auction IDs, event payloads, document names, and chain hashes. This makes it useful for operational trend review without turning it into a raw audit-record or participant-data export. The generated file is private and sent with `Cache-Control: private, no-store`.

The export does not replace the event ledger or public per-auction integrity verification. Use the auction's public verification page to check a specific published auction chain.
