# Production readiness backlog

Goal: launch a secure, accessible auction service with a small verified pilot, then expand capabilities in reviewable steps. A feature is complete only when its UI/API path, production configuration, failure handling, and operational instructions work together.

## Milestone 0 — Safe pilot launch

- [ ] Choose a pilot organization, auction type, support contact, and launch criteria.
- [ ] Verify production secrets and configuration: database, JWT/auth, CORS, Telegram, AI, SMTP, storage, and malware scanning.
- [ ] Deploy database migrations and confirm persistent document storage survives a restart/deploy.
- [ ] Walk through the complete auction lifecycle in the deployed environment: create, publish, register, bid, close, award, audit verification, and document access.
- [ ] Confirm backups, restore procedure, monitoring, error alerts, and incident ownership.
- [ ] Complete an off-host backup copy and isolated restore drill; configure backup, health, and incident alerts with named owners.
- [x] Publish an operator runbook: [docs/production-runbook.md](docs/production-runbook.md).
- [ ] Publish the pilot's real user support contact, hours, and complaint/dispute route.

## Milestone 1 — Close existing end-to-end gaps

- [x] Add a safe, documented structured-data web-source adapter with explicit field mapping and public-IP validation/pinning: [adapter guide](packages/api/src/autofetch/adapters/README.md).
- [x] Show fetch failures, duplicate/stale/error counts, last successful fetch, source links, and expandable conflict flags in the admin review queue.
- [ ] Apply migrations 017–018 and exercise the web adapter and review queue end to end against a permitted public fixture.
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
  - [ ] Audit remaining core screens, validation/errors, notifications, and Telegram/voice responses; obtain fluent-speaker review.
- [ ] Cache useful read-only auction and bid-history data for offline viewing; show timestamps and clearly defer writes until online.
  - [x] Persist only public auction listings, published auction details, and lots in a bounded, seven-day browser cache; show the saved timestamp offline and disable bidding until reconnection.
  - [ ] Decide and implement privacy-safe offline access to authenticated bid history; validate stale-data behavior on supported browsers.
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
- [ ] Add watchlists and configurable alerts through available channels.
- [ ] Expand anomaly explanations with links to relevant past flags and outcomes.

## Milestone 4 — Public transparency and operations

- [ ] Decide and implement additional public result exports; weekly CSV export remains intentionally excluded.
- [x] Review the open-data API contract: public-field whitelist, pagination bounds, stable UTC timestamp shape, and route-specific request limits. See [docs/open-data-api.md](docs/open-data-api.md).
- [x] Keep QR links on published auction notices; verify their destinations in deployed acceptance.
- [ ] Add a sealed-bid opening ceremony view with auditable timestamps and role controls.
- [ ] Package dispute evidence, including relevant audit records and file hashes, for authorized download.
- [ ] Define an independently verifiable chain-head anchoring design and operating owner before implementation.
- [ ] Add internal audit analytics export with access controls and data minimization.

## Milestone 5 — Advanced auction models and scale

- [ ] Define reverse-auction and multi-lot rules, permissions, audit events, and participant UX before implementation.
- [ ] Integrate bank deposit-status checks with a bank/provider, reconciliation rules, and manual fallback.
- [ ] Measure PWA usage and reliability; decide whether native apps solve a demonstrated gap.
- [ ] Build native apps only after the pilot provides usage evidence and the API contract is stable.

## Current checkpoint

The operator reports that the app is deployed on EthioDeploy and working. Deployment is no longer the active workstream. The repository contains auction audit verification, public QR links, a read-only open-data API, an auto-fetch review queue, Telegram bot flows, and partial Amharic/PWA support. Weekly CSV export is intentionally excluded per the prior request.

The active workstream is **functionality**. The structured web adapter, review-queue status/context, Gemini/OpenRouter voice fallback, Telegram bid replay/rate protection, hardened public-data contract, initial Amharic accessibility fixes, bounded public-auction offline cache, and local document extraction/review/search flow are implemented. OCR and original documents stay on the API host; output remains unverified until an authorized officer checks it. API and web TypeScript checks pass. Migrations 017–019 and provider-backed web/voice/OCR acceptance still need to run in the deployed environment. Continue through the remaining unchecked tasks one at a time and record their end-to-end evidence here.
