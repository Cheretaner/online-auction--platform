# @auction/api

Backend for the AI-Powered Transparent Online Auction System.
Node 22 + Express 5 + PostgreSQL 16. No containers.

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

Three scripts in `deploy/`, meant to be run in this order on a fresh
Ubuntu/Debian host.

### 1. Provision (once)

```bash
sudo bash deploy/provision.sh
```

Installs Node 22, pnpm, PostgreSQL and nginx; creates the `auction` system
user; creates `/etc/auction/api.env` with **freshly generated secrets**; and
creates the database role via `deploy/bootstrap-db.sql`.

Then edit `/etc/auction/api.env` and set at minimum:

- `BOOTSTRAP_SUPER_ADMIN_EMAIL` — whoever will run the platform
- `CORS_ORIGIN` — your real front-end origin (`*` is refused in production)

Back that file up. Rotating `JWT_SECRET` signs out every existing session.

### 2. Deploy (every release)

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

### 3. TLS

```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/auction-api
sudo ln -s /etc/nginx/sites-available/auction-api /etc/nginx/sites-enabled/
# edit server_name, then:
sudo certbot --nginx -d api.example.com
sudo nginx -t && sudo systemctl reload nginx
```

Keep `TRUST_PROXY_HOPS` equal to the number of proxies in front of the API —
`1` for the nginx config above. Too high and a client can forge
`X-Forwarded-For` to escape its own rate-limit bucket; too low and every
client shares the proxy's bucket.

### Operating

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
policies are defence in depth for any read-only role you attach later.
`bootstrap-db.sql` sets this up correctly. If you repoint `DATABASE_URL` at a
non-owner role, every write is denied and the failures look like unrelated
application bugs.

**Migration filenames are the primary key.** They apply in filename order:
`001_core` → `002_security_foundation` → `003_operational` →
`003_schema_alignment` → `004_add_estimated_value` → `004_hardening` →
`005_role_alignment`. Two pairs share a numeric prefix; the sort is still
deterministic, but never rename a migration that has been applied anywhere,
because `schema_migrations` keys on the filename.

**`tsc` does not emit `.sql`.** `deploy.sh` copies the migration files into
`dist` explicitly. If you build by hand, do the same or the runner finds no
migrations.

**Roles live in the access token.** Anyone granted a new role must log in
again (or call `POST /api/v1/auth/refresh`) before it takes effect.

**The scheduler is load-bearing.** The `auction-lifecycle` job is the only
thing that opens scheduled auctions and closes live ones. If the process is
not running, approved auctions never open. Running more than one instance is
safe — every transition takes a row lock and re-checks under it — but at
least one must be up.

---

## Bootstrapping a usable system

`organization_members` only models roles *inside* an organization, so a fresh
database has nobody who can create the first one. The account matching
`BOOTSTRAP_SUPER_ADMIN_EMAIL` is promoted to `super_admin` when it registers;
if that variable is unset, the first account ever registered is promoted.

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

## Testing

`pnpm test` runs the unit tests that exist (money, result, idempotency, jwt).
There is **no integration coverage**. `scripts/smoke.mjs` is a harness, not a
test suite — but it does exercise registration, org creation, role grants,
KYC, auction creation, the two-person approval rule, public discovery, bid
rejection before open, the audit chain, compliance and notifications.
