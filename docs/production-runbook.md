# Production operator runbook

This runbook is for a controlled pilot on the self-managed Ubuntu/Debian deployment. A successful build or `/health/ready` response does not by itself authorize public bidding. Complete the release gates below with the pilot organization and record the evidence before inviting bidders.

## Before provisioning

- Select the pilot organization, auction type, named support contact, support hours, and incident owner.
- Confirm the organization is authorized to run the auction and approve the auction terms, deposit policy, KYC evidence/retention policy, and dispute process.
- Choose a DNS name and configure a host with a persistent disk sized for PostgreSQL, private uploaded documents, and backups. Keep a separate off-host encrypted backup destination.
- Identify who controls the domain, database, SMTP sender, AI provider, and (if enabled) Chapa merchant account. Use organization-controlled accounts and unique production credentials.
- Decide whether bidding is a controlled, invited pilot. Do not advertise availability until the live acceptance and restore checks below pass.

## Provision and configure

1. Provision a supported Ubuntu/Debian host using `sudo bash deploy/provision.sh`.
2. Edit `/etc/auction/api.env`. Set the real `BOOTSTRAP_SUPER_ADMIN_EMAIL`, `CORS_ORIGIN`, `WEB_BASE_URL`, SMTP host/credentials/sender, and at least one Gemini or OpenRouter key. Production startup requires an AI provider key, working SMTP, database URL, JWT secret, independent PII encryption/hash secrets, filesystem storage, and file scanning. Do not paste secrets into tickets or source control.
3. Confirm `STORAGE_DIR=/var/lib/auction/storage`, `FILE_SCAN_ENABLED=true`, and that ClamAV is running and reachable at the configured host/port. The provisioner installs local ClamAV; container deployments need a reachable ClamAV service and a persistent mounted volume instead.
4. Configure Telegram only if it is part of the pilot. Production uses either a public HTTPS webhook plus a long random `TELEGRAM_WEBHOOK_SECRET`, or explicitly enabled polling. Do not enable both modes without an operational reason. Voice notes require a configured transcription provider; test its failure response and bid confirmation path before offering voice bidding.
5. Keep Chapa disabled until a merchant account, webhook secret, callback URL, sandbox acceptance, and controlled live acceptance are complete. Manual CPO/bank-guarantee verification remains an officer process; never treat a bank name or reference format as proof of funds.
6. Protect `/etc/auction/api.env` and back up its encryption keys separately. Losing or rotating `PII_ENCRYPTION_KEY` can make previously encrypted identity and bank data unreadable. Rotating `JWT_SECRET` invalidates active sessions.

## Deploy and verify a release

1. Configure the domain in `deploy/nginx.conf`, install the nginx site, obtain TLS, and verify nginx forwards only the intended host to the API. Set `TRUST_PROXY_HOPS=1` for this nginx topology.
2. Run `sudo bash deploy/deploy.sh --ref <reviewed-ref>`. The script builds a release, applies migrations, switches the release symlink, restarts the API, and rolls back the application release if readiness fails. Database migrations are not automatically rolled back.
3. Check `sudo systemctl status auction-api`, `sudo journalctl -u auction-api -n 200 --no-pager`, and `curl -fsS https://<domain>/health/ready`. The readiness endpoint requires the database and critical scheduled jobs to be healthy.
4. Confirm the expected migration set is applied and the persistent storage directory is writable by the service account. Confirm the web app, API, email delivery, document upload/download, ClamAV scanning, and public audit verification over HTTPS.
5. Before enabling a real auction, create a disposable staging auction and run the end-to-end acceptance checklist below with test accounts. The repository smoke script creates accounts and auction records; use it only against an isolated disposable database, never production.

## Controlled-pilot acceptance checklist

Record date, release/ref, environment, operator, test account IDs, and outcome for each step. Use test-only funds and documents until the pilot owner approves public operation.

- [ ] Register the designated platform administrator; verify no other account can self-assign platform or organization privileges.
- [ ] Create the pilot organization, grant the minimum roles, and verify a user from another organization cannot access its auctions or private files.
- [ ] Submit KYC evidence and a deposit reference; verify the private evidence is visible only to authorized reviewers and every decision has an audit event.
- [ ] Create, review, publish, discover, and register for an auction. Verify dates, ETB amounts, deposit terms, and public/private fields.
- [ ] Place valid and invalid bids. Verify KYC/deposit gates, idempotent retries, rate limits, concurrent bid ordering, and sealed-bid confidentiality where applicable.
- [ ] Close and award using the documented officer workflow. Verify reserve behavior, two-person controls, settlement/refund state, notifications, and audit-chain verification.
- [ ] Upload, scan, download, and revoke access to a document. Verify infected/unavailable scanner behavior fails closed and private-file links are not public.
- [ ] Exercise account recovery email, in-app updates, and every pilot channel enabled (Telegram/voice/payment provider); verify provider failures are visible and do not create a false success.
- [ ] Confirm the public audit-verification page and open-data response do not expose bidder identities, private evidence, or organization-private records.
- [ ] Confirm mobile keyboard/screen-reader basics and Amharic wording with fluent reviewers if the pilot advertises Amharic support.
- [ ] Obtain written pilot-owner acceptance and publish support contact, business hours, complaint/dispute route, auction rules, and incident response contact.

## Backups and restore

The provisioner installs a nightly database and document backup under `/var/backups/auction`, retained locally for 14 days. The script uses restrictive permissions, validates both archives, and writes SHA-256 checksums. A same-host backup is not disaster recovery.

- Copy completed backup files to an encrypted off-host destination with access logging and retention approved by the data owner. Protect backups as highly sensitive because document archives contain identity and deposit evidence.
- Alert on a missing daily backup, non-zero backup job exit, checksum mismatch, low disk space, or failure to copy off host. Review `/var/log/auction-backup.log` and the host's cron/mail monitoring.
- Before launch, restore a recent database and storage archive onto an isolated host/database. Verify checksum with `sha256sum -c`, restore database using `pg_restore`, extract storage under `/var/lib/auction`, and confirm documents open through the API. Do not restore over production as a drill.
- Record the restore date, backup age, elapsed recovery time, record/document checks, and the owner who approved the result. Set recovery point/time objectives with the pilot organization.

Example isolated restore commands (replace paths/database and run only on the restore host):

```bash
sha256sum -c auction-<stamp>-SHA256SUMS
sudo -u postgres createdb auction_restore
sudo install -o postgres -g postgres -m 600 auction-<stamp>.dump /var/lib/postgresql/auction-restore.dump
sudo -u postgres pg_restore --no-owner --dbname=auction_restore /var/lib/postgresql/auction-restore.dump
sudo rm /var/lib/postgresql/auction-restore.dump
sudo tar -xzf auction-<stamp>-storage.tar.gz -C /var/lib/auction
```

## Monitoring and incident response

- Monitor external HTTPS `/health/ready` every minute and alert on any non-200 response. Also alert on repeated API 5xx, scheduler errors, database/volume capacity, SMTP failures, ClamAV failures, and missed backup/off-host-copy jobs.
- Review `journalctl -u auction-api` and nginx access/error logs daily during the pilot. Restrict log access and retention; never add tokens, identity numbers, bank references, or document contents to logs.
- Name a primary and backup incident responder. Keep provider, DNS, host, and database recovery contacts in the organization's approved secure store.
- For suspected account compromise, disable the affected account/session, preserve audit and relevant host logs, notify the incident owner, and follow the organization's privacy/breach process. Do not edit the append-only audit ledger to hide an incident.
- For bid, payment, or document-integrity disputes, pause the affected auction using the approved officer process, preserve records, and use the documented dispute channel. Do not promise a refund or bank confirmation until the provider/bank has confirmed it.

## Hard launch blockers requiring external evidence

- Pilot owner, support and incident contacts, operating hours, approved auction/deposit/settlement rules, dispute route, privacy and retention decisions.
- Production DNS/TLS, infrastructure access, database credentials, SMTP sender verification, AI provider credentials, persistent storage, ClamAV reachability, off-host backups, and a successful restore drill.
- Full deployed acceptance run with privacy/authorization checks and written pilot sign-off.
- For Chapa: merchant onboarding, webhook setup, sandbox cases and controlled live acceptance. Until then, do not claim automatic payment or refund verification is live.
- For identity claims: compliance authorization for KYC collection/retention and any official identity-provider access. Current manual review does not establish government identity authenticity.
- Bank confirmation process and authorized contacts for manual CPO/bank-guarantee verification.

The API validates required production configuration at startup; see `packages/api/src/config/env.ts` and the deployment details in `packages/api/README.md`. Production keys and external-service evidence must be supplied by the operator and must not be committed to this repository.
