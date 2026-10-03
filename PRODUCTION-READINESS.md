# Production readiness backlog

Goal: launch a secure, accessible auction service with a small verified pilot, then expand capabilities in reviewable steps. A feature is complete only when its UI/API path, production configuration, failure handling, and operational instructions work together.


## Milestone 1 — Close existing end-to-end gaps

- [x] Add a safe, documented structured-data web-source adapter with explicit field mapping and public-IP validation/pinning: [adapter guide](packages/api/src/autofetch/adapters/README.md).
- [x] Add bounded AI extraction suggestions for public pages without structured metadata; require cited source text, cap confidence at 45%, require reviewed title/quantity and expose editable fields/evidence to officers, record changes and final approved fields in the auto-fetch audit, and keep every suggestion in the review queue. Remote AI processing is configurable and can be disabled per source.
- [x] Show fetch failures, duplicate/stale/error counts, last successful fetch, source links, and expandable conflict flags in the admin review queue.
- [ ] Apply migrations 017–018 and exercise structured and AI-assisted web extraction against a permitted public fixture; verify quoted evidence, the 45% AI confidence cap, stub-provider handling, review approval/rejection, and duplicate detection.
- [ ] Complete Telegram production setup and exercise discovery, account linking, bid confirmation, status, alerts, and audit verification against production-like data.
- [x] Add Gemini/OpenRouter voice provider fallback, bounded audio downloads, actionable unavailable-provider messaging, and confirmation before a voice bid. See [voice processing notes](docs/telegram-voice.md).
- [ ] Exercise voice transcription and bid confirmation in English and Amharic using approved provider credentials and fluent-speaker review.
- [ ] Close remaining authorization, rate-limit, audit-log, and abuse checks for all bidding channels.
  - [x] Add per-Telegram-account bid/voice rate limits and replay-safe bid idempotency for a confirmation button.
  - [x] Restrict Telegram account linking, bid status, personalized auction details, and assistant messages to private chats.
  - [ ] Review remaining bot authorization boundaries and exercise webhook replay, rate-limit, and audit behavior.

## Milestone 2 — Accessibility and low-bandwidth access

- [ ] Complete Amharic coverage for core auction flows, validation/errors, notifications, and assistant responses; review with fluent speakers.
  - [x] Translate hard-coded public auction lot details, transparency-panel labels, and KYC document hints into the existing English/Amharic catalogs.
  - [x] Instruct the AI assistant to answer in the user's language and preserve auction identifiers and ETB amounts.
  - [x] Pass the selected English/Amharic locale from the web assistant and linked Telegram preference into the assistant request, including for voice-note questions.
  - [x] Localize explicit shared-schema errors for bid amounts/commitments, dates, Fayda/TIN/identity fields, and dispute/deposit decisions in Amharic.
  - [x] Add persisted Telegram `/language en|am` preference and localize discovery, auction details, status, audit verification, help, voice guidance, and bid confirmations/results; language is user-selectable only after the Telegram account is linked.
  - [x] Localize the supported watchlist status and bid-activity Telegram notifications and their action buttons from the recipient's saved preference; other notification types remain as authored until individually translated.
  - [x] Replace the generic notification-record view with readable, individually markable notification cards; localize the supported auction, watchlist, bid, deposit, identity, dispute, organization, report, and anomaly notices in Amharic while preserving amounts and human-authored decision reasons.
  - [ ] Audit remaining core screens, validation/errors, notifications, and Telegram/voice responses; obtain fluent-speaker review.
  - [ ] Apply migration 022 and review Telegram notification translations and voice responses with fluent speakers.
- [ ] Cache useful read-only auction and bid-history data for offline viewing; show timestamps and clearly defer writes until online.
  - [x] Persist only public auction listings, published auction details, and lots in a bounded, seven-day browser cache; show the saved timestamp offline and disable bidding until reconnection.
  - [x] Cache only the signed-in bidder's own bid receipts in bounded seven-day `sessionStorage`, keyed and query-partitioned by account; preserve the cached identity only during network failures and clear history on logout or authorization revocation. Offline display shows the saved timestamp; bids remain disabled while offline. See [offline access details](docs/offline-access.md).
  - [ ] Validate stale-data behavior, account switching, logout clearing, and tab-session expiry on supported browsers.
- [ ] Define and implement USSD or feature-phone access with a telecom provider and secure bid confirmation.
- [ ] Add SMS and voice delivery only after provider, consent, opt-out, and delivery-status flows are operational.

## Milestone 3 — Documents and auction intelligence

- [ ] Add OCR for terms and bid-bond documents, with extracted text linked to the original and visibly marked for human verification.
  - [x] Implement local OCR and embedded-PDF text extraction, linked to the checksum-verified original and limited to authorized auction staff; machine output stays marked unverified until confirmed or corrected by a person.
  - [x] Add indexed search over human-reviewed text within the officer's auction organization and audit events for extraction and review.
  - [ ] Apply migration 019 and exercise image, text-PDF, and scanned-PDF extraction with English and Amharic language data in the deployed environment.
- [ ] Add deposit-reference OCR suggestions with officer verification and an audit record.
  - [x] Suggest labeled reference values from deposit-proof OCR, compare them with the submitted reference, and record the officer's result without auto-verifying or changing the deposit.
  - [ ] Validate extraction against real redacted CPO samples in English and Amharic and review false-positive behavior.
- [ ] Add historical price/participation insights with clear source and sample-size context.
  - [x] Add organization-scoped 36-month comparable-auction metrics for median awarded price, median bid count, and award rate, matched on auction type and the target's available region/categories; the UI shows sample counts and warns below five records.
  - [ ] Validate SQL and interpretations against known auction records and a larger sample in the deployed database.
- [ ] Add watchlists and configurable alerts through available channels.
  - [x] Let signed-in users follow up to 100 scheduled/live auctions, choose bid/status alerts and in-app/email/linked-Telegram channels, and remove a watch; outbox fan-out is replay-safe, limits bid alerts to one per 5 minutes/channel, hides sealed values, and caps an auction at 500 watchers.
  - [ ] Apply migration 020 and exercise opt-in/out, linked/unlinked Telegram, email delivery, sealed-bid privacy, replay, and fan-out limits.
- [x] Expand anomaly explanations with links to relevant past flags and outcomes: same-organization records sharing a subject account include their review decision and auction result; sealed award amounts stay hidden until opening. Linked historical records load through an access-checked detail endpoint. Migration 021 adds indexes for subject overlap and history ordering.
- [ ] Apply migration 021 and verify that unrelated organizations are excluded, shared-account history links open, and sealed award amounts remain private until the opening ceremony.

## Milestone 4 — Public transparency and operations

- [x] Keep public results machine-readable through the existing paginated JSON open-data API; no additional public export is planned, and the weekly CSV export remains intentionally excluded.
- [x] Review the open-data API contract: public-field whitelist, pagination bounds, stable UTC timestamp shape, and route-specific request limits. See [docs/open-data-api.md](docs/open-data-api.md).
- [x] Keep QR links on published auction notices; verify their destinations in deployed acceptance.
- [x] Add a sealed-bid opening ceremony view with auditable timestamps and role controls: officers get an irreversible-action confirmation, close/open timestamps, recorded-bid count, and a post-opening register of active bids; the existing API authorization and append-only opening event remain authoritative.
- [ ] Verify role denial, close-time eligibility, event-chain timestamps, and bid visibility before/after opening in the deployed environment.
- [x] Package dispute evidence, including relevant audit records and file hashes, for authorized download: authorized organization reviewers can download a no-store JSON bundle with the dispute record, full auction audit chain and integrity result, and auction-document SHA-256 manifest. Downloads append an audit event. Original files are not duplicated into the bundle.
- [ ] Verify cross-organization denial, checksum manifest accuracy, and bundle chain integrity in deployed acceptance.
- [x] Define an independently verifiable chain-head anchoring design and operational roles before implementation; the platform security owner must be assigned from the pilot's super-admin roster.
- [ ] Record the named security owner, choose the managed signing-key service and independent anchor provider, then implement and verify public proofs. See [anchoring design](docs/audit-chain-anchoring.md).
- [x] Add internal audit analytics export with access controls and data minimization: a rolling 90-day, organization-scoped CSV groups UTC day/action/actor role/entity type and counts only. It omits actor IDs, auction IDs, event payloads, filenames, and hashes; response is private/no-store. See [export notes](docs/audit-analytics-export.md).
- [x] Scope internal audit event listing to the selected organization or explicitly authorized auction; arbitrary event/entity filters can no longer bypass organization boundaries.
- [ ] Verify organization scoping, role denial, and CSV privacy fields in deployed acceptance.

## Milestone 5 — Advanced auction models and scale

- [x] Define proposed reverse-auction and independent multi-lot rules, permissions, audit events, and participant UX before implementation. See [design proposal](docs/reverse-auction-multilot-design.md).
- [ ] Get pilot-owner approval for reserve visibility, eligibility/deposit policy, withdrawal window, and per-lot deposit rules before implementing the schema and bid paths.
- [ ] Integrate bank deposit-status checks with a bank/provider, reconciliation rules, and manual fallback.
- [ ] Measure PWA usage and reliability; decide whether native apps solve a demonstrated gap.
- [ ] Build native apps only after the pilot provides usage evidence and the API contract is stable.

## Current checkpoint

The operator reports that the app is deployed on EthioDeploy and working. Deployment is no longer the active workstream. The repository contains auction audit verification, public QR links, a read-only open-data API, an auto-fetch review queue, Telegram bot flows, and partial Amharic/PWA support. Weekly CSV export is intentionally excluded per the prior request.

The active workstream is **functionality**. The structured and evidence-backed AI web adapter, editable review queue, review-queue status/context, Gemini/OpenRouter voice fallback, Telegram bid replay/rate protection, hardened public-data contract, initial Amharic accessibility fixes, bounded public-auction offline cache, session-scoped own-bid history cache, local document extraction/review/search, organization-scoped historical insights, configurable auction watchlists, linked anomaly history, sealed-bid opening register, dispute evidence download, and minimized internal audit analytics export are implemented. Internal audit event listing and analytics are scoped to the selected organization. Telegram now persists a linked user's English/Amharic preference and localizes core bot flows; in-app notifications localize supported event types. Unknown notices and provider-generated Amharic still need review by fluent speakers. OCR and original documents stay on the API host; extraction and alert results remain advisory until reviewed. API and web TypeScript checks pass for the feature set; repeat deployed-provider, role-scope, browser-cache, and migration acceptance remains outstanding. Migrations 017–022 and provider-backed web/voice/OCR/email/Telegram acceptance still need to run in the deployed environment. Continue through the remaining unchecked tasks one at a time and record their end-to-end evidence here.
