**Deep audit of the Online Auction Platform (“stark-hackaton”)**

This is a well-structured monorepo (API + web + shared) for an Ethiopian-oriented transparent online auction system (open ascending + sealed bids, deposits/CPO-style bid security, KYC, compliance, audit ledger, Telegram, AI assistance, autofetch, etc.). The architecture, audit trail, two-person rules, anti-snipe, sealed-bid commitments, and deposit gating are thoughtfully designed for a **prototype / hackathon / controlled pilot**.

It is **not production-ready** for real money, real identity, or real Ethiopian financial/government systems. Below is a prioritized, exhaustive list of gaps and next moves, grouped so you can tackle them one-by-one.

---

### 1. Payment / Deposit / Banking Integration (Critical – Business Logic + Functionality)

**Current state**
- Deposits are **purely manual**:
  - User enters `referenceNumber`, `issuingBank`, `instrumentType` (`cpo` | `bank_guarantee` | `transfer`), optional document upload.
  - Officer manually reviews → `verified` / `rejected`.
  - No payment initiation, no webhook, no bank API, no balance check, no automatic verification.
- No Chapa, Telebirr, CBE Birr, Amole, M-Pesa, or any gateway code, env vars, or webhooks anywhere in the codebase.
- Deposit release is a status change only (no actual fund movement).
- Winner determination exists; there is **no post-award settlement / payment collection / refund flow**.

**Issues**
- Anyone can submit a fake reference number. Officers have no automated way to confirm the instrument is real or funded.
- No support for real-time digital payments that Ethiopian users actually use.
- No refund automation when a bidder loses or an auction is cancelled.
- No winner payment (full purchase price) collection after award.
- Instrument types are limited to traditional paper-style instruments; modern digital rails are missing.

**Next moves (recommended order)**
1. **Decide product direction**
   - Keep traditional CPO/bank-guarantee as primary (government-style auctions) **and/or**
   - Add modern digital deposit options (Chapa / Telebirr / CBE Birr).
2. **Integrate a real payment provider** (strongly recommend **Chapa** first – it is the most developer-friendly Ethiopian gateway and supports mobile money + cards + bank transfers).
   - Add `CHAPA_SECRET_KEY`, `CHAPA_PUBLIC_KEY`, `CHAPA_WEBHOOK_SECRET` to env.
   - New endpoints: `POST /deposits/initiate` → create Chapa checkout / transfer intent → return payment URL or reference.
   - Webhook handler (`POST /webhooks/chapa`) that verifies signature, updates deposit status to `verified` (or `failed`), writes audit event, notifies user.
   - Idempotency + replay protection on webhooks.
3. **Hybrid model** (recommended for government auctions)
   - Keep existing manual CPO/bank-guarantee flow.
   - Add “Pay with Chapa / Telebirr” option that auto-verifies.
4. **Post-award settlement**
   - After `awarded`, create a “final payment” obligation for the winner.
   - Integrate same gateway for the remaining amount (or full amount if deposit is only security).
   - Automatic deposit release / refund for non-winners.
5. **Bank instrument verification**
   - At minimum: structured bank list + reference format validation.
   - Longer term: partner with banks for API verification of CPOs/guarantees (or use a verification service).

---

### 2. Identity / National ID / KYC (Critical – Validation + Security + Business Logic)

**Current state**
- Registration collects optional `nationalId` / `tinNumber`.
- KYC page lets user choose `national_id` (labelled “Fayda national ID”), `kebele_id`, or `passport` and type a free-text `documentNumber`.
- Submission creates a `pending` verification record.
- Compliance officer manually approves/rejects.
- Duplicate check only looks for same national ID / TIN already in the system.
- **No call to Fayda, no NIDA, no OCR, no face match, no document authenticity check.**

**Issues**
- “Fayda national ID” is just a label. Anyone can type any string.
- No document image upload tied to the verification record (only free-text number).
- No real uniqueness / liveness / authenticity guarantee.
- Verification status gates bidding, so fake verified accounts can bid.

**Next moves**
1. **Short-term hardening**
   - Require document image upload for every verification.
   - Stronger format validation (Ethiopian national ID patterns, TIN checksum if known).
   - Store hashed national ID / TIN for privacy.
2. **Real identity integration**
   - Integrate **Fayda** (or the official National ID API when available) for verification.
   - Fallback: partner with a licensed KYC provider that supports Ethiopian IDs + passport + kebele.
3. **Enhanced KYC flow**
   - Capture selfie + document photo → basic face match / liveness.
   - Store verification evidence with checksum in the audit trail.
4. **Business rules**
   - Make verified status mandatory for high-value auctions or for placing deposits above a threshold.
   - Re-verification policy (expiry, change of details).

---

### 3. Business Logic Gaps (Auction Lifecycle & Money)

| Area | Current behaviour | Gap / Risk | Recommended next move |
|------|-------------------|------------|------------------------|
| Deposit requirement | Checked at bid time | Manual verification creates race / fraud window | Auto-verify digital deposits; shorten manual review SLA |
| Winner selection | Auto for open ascending; manual for sealed | No automatic final payment | Add settlement workflow after award |
| Deposit release | Manual status change | No real fund movement | Tie release to gateway refund / bank instruction |
| Refunds | None | Losers keep money locked until officer acts | Auto-release non-winner deposits on award / cancel |
| Reserve price | Exists | No clear “reserve not met → cancel” automation | Explicit outcome + notifications |
| Sealed bid opening | Officer triggers | Nonce must be kept client-side | Add secure client storage + recovery UX |
| Multi-item auctions | Supported | Deposit logic is per-auction, not per-item | Clarify whether deposit covers whole auction or individual lots |
| Currency | Hard-coded ETB-style Money | No multi-currency | Confirm single currency (ETB) and document it |

---

### 4. Security Gaps

**Already good**
- Helmet, CORS (production refuses `*`), rate limiting (global + auth), JWT + refresh token rotation, bcrypt, audit hash chain, IP hashing, idempotency keys, file name sanitization, RLS-oriented org context, two-person rules, self-review prevention.

**Still needed / improve**
1. **Webhook security** – When you add Chapa (or any gateway), implement signature verification + timestamp tolerance + idempotency.
2. **File upload**
   - MIME + magic-byte validation (currently trusts client-supplied mime).
   - Virus scanning (ClamAV or cloud scanner) before making documents available.
   - Size limits already exist; enforce them strictly per document type.
3. **Sensitive data**
   - National ID / TIN / bank reference should be encrypted at rest or at least hashed where possible.
   - Access logs for viewing deposit bank details.
4. **Secrets**
   - `.env` is present in the extracted tree; ensure it is never committed and production uses a secrets manager.
5. **CSRF** – API is JWT Bearer; if you ever add cookie-based sessions, add CSRF protection.
6. **Admin actions** – High-privilege actions (award, release deposit, approve KYC) should require re-authentication or step-up.
7. **Rate limits on deposit/KYC submission** – Prevent spam of pending records.

---

### 5. Validation & Data Integrity

**Current strengths**
- Zod schemas shared between frontend and backend.
- Money as string with 2-decimal regex.
- Positive amount checks, unique deposit per bidder+auction, sealed-bid commitment consistency, etc.

**Gaps**
- `documentNumber` and `referenceNumber` are free text (min 1).
- `issuingBank` free text (no controlled vocabulary of Ethiopian banks).
- No checksum / format validation for Ethiopian national ID or TIN.
- `instrumentType` limited to three values; no digital payment instrument.
- Frontend and backend both validate, but error mapping for field-level errors is partial in some places.

**Next moves**
- Add stricter regexes / bank list enum.
- Add server-side format validators for Ethiopian identifiers.
- Return structured field errors consistently so the UI can highlight them.

---

### 6. Functionality & Completeness Gaps

- **No real-time payment status UI** – Deposit page only shows manual status.
- **No buyer/seller wallet or ledger** – Everything is status-driven, not double-entry.
- **Notification channels** – In-app + email + Telegram exist; SMS (for Ethiopian mobile) is missing.
- **Reporting** – Basic reports exist; financial reconciliation reports (deposits received vs released vs held) are weak.
- **Offline / poor connectivity** – Sealed-bid nonce is client-side only; no recovery if the user clears storage.
- **Multi-language** – UI appears English-only; Ethiopian auctions usually need Amharic.
- **Accessibility & mobile UX** – Deposit and KYC forms are functional but not optimised for low-end devices common in Ethiopia.
- **Autofetch / AI** – Nice features, but they are not core to the money/identity path and can stay as secondary.

---

### 7. Recommended Implementation Roadmap (Prioritised)

**Phase 0 – Immediate hardening**
- Lock down file uploads (magic bytes + size + virus scan).
- Add bank list + stronger validation on deposit and KYC forms.
- Encrypt or hash national ID / TIN.
- Document the exact manual process officers must follow for CPO verification.

**Phase 1 – Digital deposits**
- Integrate **Chapa** (initiate + webhook + status sync).
- Keep manual CPO path as fallback.
- Auto-release non-winner deposits on award.

**Phase 2 – Real identity **
- Fayda / licensed KYC provider integration.
- Document image + basic liveness.
- Make verified status a hard gate for high-value auctions.

**Phase 3 – Full settlement**
- Winner final payment flow.
- Refund automation.
- Financial reconciliation reports and audit export.

**Phase 4 – Polish**
- Amharic localisation.
- SMS notifications.
- Improved sealed-bid recovery UX.
- Production secrets management and monitoring.

---

## Implementation Checklist (2026-10-02)

Status refers to repository implementation. External provider credentials, bank confirmations, migration execution, and live acceptance tests still require deployment/operator access.

### 1. Payment, Deposits, and Banking
- [x] Keep manual CPO, bank-guarantee, and transfer registration alongside a Chapa checkout path.
- [x] Add Chapa initialization, signed webhook verification, provider-side transaction verification, ETB/amount matching, transaction idempotency, and replay-age checks.
- [x] Add `CHAPA_SECRET_KEY`, optional `CHAPA_PUBLIC_KEY`, and `CHAPA_WEBHOOK_SECRET` to environment validation and examples.
- [x] Store provider transactions durably and expose payment status after hosted-checkout return.
- [x] Add a due-date settlement obligation on award and Chapa final-payment collection; the bid-security amount is not credited against the final price.
- [x] Automatically initiate and reconcile full Chapa refunds for non-winners and cancelled auctions; release state changes only after Chapa confirms `refunded`.
- [x] Require private evidence and a release reference before manually releasing CPO/guarantee deposits; prevent status-only release of Chapa deposits.
- [x] Add auction-scoped payment, refund, settlement, and exception reconciliation output with audit digest/export.
- [x] Add the 32 names published by NBE to a shared enum. Source and snapshot date: [NBE bank directory](https://nbe.gov.et/financial-institutions/banks/) and its [public records endpoint](https://nbe.gov.et/wp-json/wp/v2/bank?per_page=100); see [docs/ethiopian-banks.md](docs/ethiopian-banks.md).
- [x] Document independent bank-contact verification and release procedures in [docs/manual-deposit-verification.md](docs/manual-deposit-verification.md).
- [ ] Configure a live Chapa merchant, webhook URL/secret, and perform sandbox plus live-money acceptance tests. The API credentials were not available in this workspace.
- [ ] Obtain issuing-bank CPO/guarantee verification access. A list match or reference format is not proof of funds.

### 2. Identity and KYC
- [x] Require an uploader-owned private identity-evidence file; validate its actual signature, size, and malware scan before storage.
- [x] Validate Fayda numbers as 12 digits from the official [Fayda/NIDP site](https://id.gov.et/); use conservative Kebele/passport syntax rules.
- [x] Encrypt profile NID/TIN, KYC document numbers, and bank references with AES-256-GCM; use keyed HMAC digests for duplicate/reference lookup.
- [x] Remove raw profile NID/TIN from general profile/session responses and audit private-document reads.
- [x] Add a `ManualReviewIdentityProvider` interface and default adapter. Its fail-closed result remains manual review; see [docs/identity-verification.md](docs/identity-verification.md).
- [x] Make verified KYC a hard gate for bids (existing rule) and add upload/submission throttles.
- [ ] Obtain authorized NIDP/Faydaverse or licensed-provider credentials, consent terms, and production integration approval. No direct access was available.
- [ ] Add approved liveness/face match, verification expiry, re-verification rules, and a documented Kebele/passport policy with compliance review.
- [ ] Establish an official TIN checksum rule if the Ministry of Revenue publishes one; current checks intentionally do not invent a checksum.

### 3. Auction Lifecycle and Money
- [x] Record sealed-bid winner/amount when opening bids and apply the reserve-price check.
- [x] Cancel open auctions with no bids or an unmet reserve; cancel sealed auctions with no reserve-qualified offer after opening.
- [x] Define current money policy: ETB only; one award/settlement per auction; multiple lots do not receive independent settlements. See [docs/chapa-payments.md](docs/chapa-payments.md).
- [x] Keep the bid-security deposit separate from the final purchase-price obligation.
- [x] Add downloadable sealed-bid JSON receipts and client-side restore/hash verification.
- [ ] Implement a double-entry wallet/ledger. Provider attempts, settlements, and refunds are auditable records but are not a general-purpose accounting ledger.
- [ ] Define item-level award/payment semantics before using multi-item auctions where lots can have different winners.

### 4. Security
- [x] Validate PDF/JPEG/PNG/WebP magic bytes, declared MIME match, document-specific size limits, and ClamAV scan results before storage.
- [x] Require signature-verified Chapa webhook processing, transaction re-verification, idempotency, and a 72-hour replay window.
- [x] Require independent production PII encryption/hash keys and prevent production startup without upload scanning.
- [x] Audit access to private documents and bank-reference details; add authenticated-account submission rate limits.
- [x] Keep bearer-token API authentication; no cookie-based session was introduced, so CSRF middleware is not applicable to the current auth model.
- [ ] Add password/MFA step-up for award, release, and KYC approval. Current controls include role checks, self-review prevention, and the auction award two-person rule, but no general reauthentication/MFA flow.
- [ ] Connect an external secrets manager and production monitoring/alerting. The provided host provisioner currently uses a root-owned, mode-0640 systemd environment file.

### 5. Validation and Data Integrity
- [x] Add controlled NBE bank names, bounded reference formats, Fayda length validation, and conservative TIN syntax checks.
- [x] Return KYC field-level format issues through shared Zod schemas.
- [x] Add migrations `011` through `016` and the idempotent `pnpm --filter @auction/api pii:encrypt-existing` backfill command. Configure and back up keys, apply migrations, and run the command before production use.
- [ ] Add a bank-directory refresh process; the shared enum is a dated snapshot and must be updated when NBE changes the roster.

### 6. Functionality and Completeness
- [x] Show digital deposit status with automatic refresh and expose winner settlement/refund states.
- [x] Add a downloadable reconciliation export and sealed-bid receipt recovery path.
- [ ] Add Amharic localization across the product; translations have not been reviewed or supplied.
- [ ] Add SMS delivery through a selected Ethiopian-capable provider; no provider account or sender registration was available.
- [ ] Run low-bandwidth/mobile accessibility and assistive-technology acceptance tests. The touched screens remain responsive, but no end-to-end device/accessibility test was available.

### 7. Release Gates
- [x] API/web TypeScript checks and focused payment, webhook, file-validation, and identity tests pass locally.
- [ ] Apply migrations `011`–`016` to a disposable PostgreSQL database and run full integration tests.
- [ ] Provision ClamAV and exercise clean/infected samples on the target host.
- [ ] Run Chapa sandbox tests for initialize, duplicate/replayed webhook, amount mismatch, failed payment, refund/reversal, and final settlement; then complete controlled live acceptance with merchant approval.
- [ ] Obtain legal/compliance approval for handling Ethiopian identity documents, retention periods, and external processor data sharing before a real-money/public-identity launch.
