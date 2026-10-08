# @auction/api

Backend for the AI-Powered Transparent Online Auction System.
Node 22 (>= 20.19) + Express 5 + PostgreSQL 16. No containers.

---

## Local development

```bash
cp .env.example .env                   # from the repo root
pnpm install
pnpm --filter @auction/shared build    # REQUIRED — see below
createdb auction                       # or use deploy/bootstrap-db.sql
pnpm migrate
pnpm dev:api
```

`@auction/shared` resolves to `./dist`, so **it must be compiled before the
API runs**. `pnpm -r build` walks the workspace in dependency order and
handles this. While developing, run `pnpm --filter @auction/shared dev` in a
second terminal to keep it rebuilding on change.

Verify:

```bash
curl -s localhost:3000/health/ready
pnpm --filter @auction/api smoke       # walks the whole flow end to end
```

---

## Production deployment

Two supported paths. Pick one — they are alternatives, not steps.

### Option A — EthioDeploy (Nixpacks, push-to-deploy)

Connect the repository to EthioDeploy and push to the deploy branch. No
Dockerfile is involved: the platform builds the pnpm workspace from source
using Nixpacks. `nixpacks.toml` in the repository root pins the Node/pnpm
toolchain, the build (`pnpm install --frozen-lockfile && pnpm build`) and the
start command (`node packages/api/dist/server.js`).

Set these as environment variables on the platform — the API **refuses to
start in production** without the first three:

- `DATABASE_URL` — the managed PostgreSQL connection string
- `BOOTSTRAP_SUPER_ADMIN_EMAIL` — whoever will run the platform
- `CORS_ORIGIN` — the real web origin (`*` is refused in production)
- `FILE_SCAN_ENABLED=true` — set the literal string `true`. Production refuses
  to start unless uploads are configured for malware scanning.
- `CLAMAV_HOST` and `CLAMAV_PORT` — the address of a reachable ClamAV daemon
  using the `clamd` TCP protocol (default port `3310`). The default host,
  `127.0.0.1`, works only when ClamAV runs in the same container as the API.
  With EthioDeploy, set `CLAMAV_HOST` to the internal hostname of a separately
  provisioned ClamAV service. Uploads fail closed with 503 when the scanner
  cannot be reached.
- `STORAGE_DRIVER=filesystem` and `STORAGE_DIR` - set `STORAGE_DIR` to the
  absolute path of a persistent volume mounted into the API container. The
  default relative directory is for local development; files in a container's
  writable layer disappear when it is replaced. Lost blobs cannot be restored
  from document metadata, so affected files need to be uploaded again.
- `STORAGE_DRIVER=supabase` uses the backend-only Supabase Storage SDK. Configure
  `SUPABASE_URL` as the project URL (not the REST endpoint), plus
  `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_DOCUMENT_BUCKET` in the deployed
  environment; the bucket must already exist. A URL ending in `/rest/v1` is
  normalized automatically. Keep the service role key server-side and never
  expose it to the web application.
- `DOCUMENT_UPLOADS_ENABLED=false` disables document uploads and new identity
  verification submissions when durable storage or a reachable malware scanner
  is unavailable. Existing documents remain listed, but files on ephemeral
  storage may already be unavailable. Keep the default `true` only when both
  storage and scanning are configured.
- `JWT_SECRET` — a random value of 32+ characters (the default is rejected)
- `RUN_MIGRATIONS_ON_BOOT=true` — applies pending migrations on boot. The
  runner holds a Postgres advisory lock, so a rolling deploy queues instead of
  colliding.
- `WEB_BASE_URL` — used in password-reset links
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` — production requires a working SMTP host and verifies connectivity at startup. Authentication fields must be set together. Use port 587 with STARTTLS (`SMTP_SECURE=false`) or port 465 with TLS (`SMTP_SECURE=true`). Local development can omit SMTP and receive reset links in the API console.
- Telegram voice notes use Gemini audio understanding or OpenRouter speech-to-text (`OPENROUTER_TRANSCRIPTION_MODEL`, default `openai/whisper-1`). Configure and acceptance-check the model/languages; OpenRouter transcription may incur separate usage charges. Voice bid intents always require a button confirmation and pass the regular bidding rules. See [Telegram voice processing](../../docs/telegram-voice.md).
- Auction document OCR runs locally with PDF.js and Tesseract (`eng+amh`). Its first run downloads language data into the writable `STORAGE_DIR/.ocr-cache`; see [document OCR setup and review flow](../../docs/document-ocr.md).
- Auction watchlist events fan out through the transactional outbox with in-app, email, and linked Telegram channels; see [watchlist alert behavior](../../docs/watchlist-alerts.md).

The web app is a separate static build; publish `packages/web/dist` as static
assets / point the platform's CDN at it rather than serving it from the API.

### Option B — Self-managed host (systemd + nginx)

Scripts in the repository-root `deploy/` directory, meant to be run in this
order on a fresh Ubuntu/Debian host. nginx serves the built web app and
proxies `/api` to the API on the same origin (`deploy/nginx.conf`).

#### 1. Provision (once)

```bash
sudo bash deploy/provision.sh
```

Installs Node 22, pnpm, PostgreSQL and nginx; creates the `auction` system
user; creates `/etc/auction/api.env` with **freshly generated secrets**; and
creates the database role via `deploy/bootstrap-db.sql`.

Then edit `/etc/auction/api.env` and set at minimum:

- `BOOTSTRAP_SUPER_ADMIN_EMAIL` — whoever will run the platform (the API
  refuses to start in production without it)
- `CORS_ORIGIN` and `WEB_BASE_URL` — your real front-end origin (`*` is
  refused in production; `WEB_BASE_URL` is used in password-reset links)
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` — production requires a working SMTP host and verifies connectivity at startup. Authentication fields must be set together. Use port 587 with STARTTLS (`SMTP_SECURE=false`) or port 465 with TLS (`SMTP_SECURE=true`). Local development can omit SMTP and receive reset links in the API console.

It also installs a nightly backup (`deploy/backup.sh`: `pg_dump` plus the
uploaded-documents directory, 14 days kept under `/var/backups/auction`). The
script validates both archives and writes restrictive, checksummed files.
Copy them to encrypted off-host storage and test a restore once before launch.
Follow the [production operator runbook](../../docs/production-runbook.md) for
the controlled-pilot acceptance, restore, monitoring, and incident steps.

Back that file up. Rotating `JWT_SECRET` signs out every existing session.

#### 2. Deploy (every release)

```bash
sudo bash deploy/deploy.sh              # deploy the current checkout
sudo bash deploy/deploy.sh --ref main   # deploy a git ref
```

Builds into a timestamped directory under `/srv/auction/releases`, runs
migrations **before** switching over, flips the `current` symlink, restarts
the service, and polls `/health/ready`. If the new release does not come up
it rolls the symlink back and restarts the old one.

**Migrations are not rolled back.** If a release fails for schema reasons,
apply the matching `.down.sql` by hand.

#### 3. TLS

```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/auction
sudo ln -s /etc/nginx/sites-available/auction /etc/nginx/sites-enabled/
# edit server_name, then:
sudo certbot --nginx -d auction.example.et
sudo nginx -t && sudo systemctl reload nginx
```

Keep `TRUST_PROXY_HOPS` equal to the number of proxies in front of the API —
`1` for the nginx config above. Too high and a client can forge
`X-Forwarded-For` to escape its own rate-limit bucket; too low and every
client shares the proxy's bucket.

#### Operating

```bash
sudo systemctl status auction-api
sudo journalctl -u auction-api -f
sudo systemctl restart auction-api
```

---

## Things that will bite you

**Row-level security.** Migration 002 enables RLS on 14 tables and defines
`SELECT` policies, but almost no `INSERT`/`UPDATE` policies. The API is
designed to connect as the **owner of the schema**, which bypasses RLS; the
policies are defence in depth for any read-only role you attach later. This
means authorization is enforced by the service layer only, which deviates
from RFC-001 decision 3 (two independent layers) — an explicit launch
decision is needed.
`bootstrap-db.sql` sets this up correctly. If you repoint `DATABASE_URL` at a
non-owner role, every write is denied and the failures look like unrelated
application bugs.

**Migration filenames are the primary key.** They apply in filename order
(`001_core` … `009_auth_sessions`). Two pairs share a numeric prefix; the sort
is still deterministic, but never rename a migration that has been applied
anywhere, because `schema_migrations` keys on the filename. The runner holds
a Postgres advisory lock, so concurrent boots cannot apply one twice.

Migrations `017_autofetch_source_fetch_state` and
`018_telegram_user_rate_limits` add persisted source fetch summaries/failures
and per-Telegram-account bid/voice throttles. EthioDeploy must apply them before
the updated AutoFetch and Telegram flows run.

**`tsc` does not emit `.sql`.** `pnpm build` copies the migration files into
`dist` (`scripts/copy-migrations.mjs`).

**Roles live in the access token.** Anyone granted a new role must log in
again (or call `POST /api/v1/auth/refresh`) before it takes effect.

**The scheduler is load-bearing.** The `auction-lifecycle` job is the only
thing that opens scheduled auctions and closes live ones; `outbox-dispatch`
is the only thing that delivers live updates and notifications.
`/health/ready` returns 503 when either has not succeeded for several ticks,
so point your uptime monitor at it, not at `/health`.

**Run exactly one API instance for now.** Two things are per-process:
live events go through an in-memory bus (a bid dispatched by instance A
never reaches browsers connected to instance B), and uploaded documents are
stored on the local disk (`STORAGE_DIR`). Lifecycle transitions themselves
are row-locked and would be safe. Scaling out needs a shared event bus
(Postgres LISTEN/NOTIFY or Redis) and object storage first.

---

## Bootstrapping a usable system

`organization_members` only models roles *inside* an organization, so a fresh
database has nobody who can create the first one. The account matching
`BOOTSTRAP_SUPER_ADMIN_EMAIL` is promoted to `super_admin` when it registers.
Production requires the variable; in development, leaving it unset promotes
the first account ever registered. No other rule grants the role.

```bash
# 1. Platform operator
curl -sX POST localhost:3000/api/v1/auth/register \
  -H 'content-type: application/json' \
  -d '{"email":"admin@example.com","password":"correct-horse-battery","fullName":"Platform Admin"}'

# 2. Create an organization (the creator becomes its first org_admin)
curl -sX POST localhost:3000/api/v1/organizations \
  -H "authorization: Bearer $ADMIN_TOKEN" -H 'content-type: application/json' \
  -d '{"name":"Ministry of Revenue","orgType":"government","tinNumber":"0001234567",
       "region":"Addis Ababa","contactEmail":"ops@example.gov","contactPhone":"+251911000000"}'

# 3. Grant colleagues their roles
curl -sX POST localhost:3000/api/v1/organizations/$ORG_ID/members \
  -H "authorization: Bearer $ADMIN_TOKEN" -H 'content-type: application/json' \
  -d '{"email":"officer@example.gov","role":"auction_officer"}'
```

## Organization context

Organization-scoped endpoints read `organizationId` from the access token,
and `withTransaction` forwards it to `app.current_org_id` for RLS. A token
gets one automatically when the user belongs to exactly one organization.
Users in several pick one:

```
POST /api/v1/auth/context  { "organizationId": "..." }
```

Requests without it fail with `403 ORG_CONTEXT_REQUIRED`.

Beyond that, every organization-scoped handler calls `assertAuctionAccess`,
which verifies the caller's organization actually owns the auction. Holding
an officer role proves only that someone is an officer *somewhere*.

## Auction lifecycle

Open-ascending auctions get a provisional winner at close, if the reserve is
met. Sealed-bid auctions are closed but never auto-awarded: amounts stay
hidden until an officer runs `POST /api/v1/auctions/:id/bids/open-sealed`.
Awarding is always an explicit officer action, and is refused while the
auction's audit chain is broken.

## Bidding

`POST /api/v1/auctions/:auctionId/bids` **requires an `Idempotency-Key`
header**. The key is stored on the bid row under a unique index, so a retried
request replays the original result instead of placing a second bid.

Placement is serialised by `SELECT ... FOR UPDATE` on the auction row and
checks, in order: auction live, within the time window, not self-bidding,
bidder KYC-verified, verified deposit where required, sealed/open commitment
consistency, and the minimum acceptable amount.

## Audit ledger

`audit_events` is an append-only hash chain, scoped per auction plus one
global ledger for events with no auction (KYC, organization changes). Updates
and deletes are blocked by trigger.

```
GET /api/v1/audit/verify                        # global ledger
GET /api/v1/audit/auctions/:auctionId/verify    # one auction
```

## Sessions

Access tokens last `JWT_EXPIRES_IN` (15 minutes) and cannot be revoked
before then. Refresh tokens are recorded in `refresh_tokens`, single-use and
rotated on every `POST /auth/refresh`; replaying a used one (outside a 30 s
multi-tab grace window) revokes the whole family. `POST /auth/logout`
revokes the session, and a password reset
(`POST /auth/password-reset/request` then `/confirm`) revokes all of them.

## Sealed bids

A sealed bid carries `commitmentHash` = hex SHA-256 of
`cheretanet-sealed-bid:v1|<auctionId>|<amount>|<nonce>`
(`sealedBidCommitmentPreimage` in `@auction/shared`). The web app computes it
in the browser and gives the bidder the nonce as a receipt, so after opening
anyone can check the recorded amount against the commitment in the audit
trail.

## Public catalogue

`GET /api/v1/auctions` takes `q`, `status`, `categoryId`, `orgId`, `region`,
`limit` (1–100, default 24) and `offset`, and returns
`{ items, total, limit, offset }`. Unpublished auctions (draft, pending
review) return 404 to anyone outside the owning organization, on the detail,
lots and live-event endpoints alike.

## Testing

```bash
pnpm test                                    # unit tests; integration tests skip
TEST_DATABASE_URL=postgres://…/auction_test pnpm test   # plus integration tests
```

`tests/integration` runs against a real, disposable Postgres database
(CI provides one): concurrent bidding, eligibility rules, the audit chain,
visibility and event-stream authorization, organization boundaries, token
rotation, password reset and catalogue paging. **Point it only at a
database you can throw away.**

`scripts/test-all-endpoints.mjs` walks every endpoint against a running API.
Set `ADMIN_EMAIL` to the API's `BOOTSTRAP_SUPER_ADMIN_EMAIL`.

## Transparency and open data

`GET /api/v1/audit/public/auctions/:auctionId/verify` publicly verifies the
hash chain for a closed or awarded auction. It returns chain integrity, event
count, head hash, and check time without exposing the underlying audit events.

`GET /api/v1/open-data/auctions?limit=100&offset=0` provides public, paginated
JSON for published auctions. It includes public auction facts and organization
names, never bidder names, profile IDs, or account data. The route does not
require authentication. It validates `limit` (1–100) and `offset` (0–1,000,000),
applies a route-specific 60 requests/minute limit, and uses a five-minute public
cache. See the [open-data API contract](../../docs/open-data-api.md).
