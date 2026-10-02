#!/usr/bin/env bash
# One-time host setup for a fresh Ubuntu 22.04/24.04 or Debian 12 server.
#
#   sudo bash deploy/provision.sh
#
# Installs Node 22, pnpm, PostgreSQL and nginx; creates the `auction`
# system user and directories; creates the database role with a generated
# password; writes /etc/auction/api.env with freshly generated secrets
# (never overwritten on re-run); installs the systemd unit and a nightly
# backup. Safe to re-run.
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "Run as root (sudo)." >&2
  exit 1
fi

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE=/etc/auction/api.env

echo "==> Packages"
apt-get update -y
apt-get install -y ca-certificates curl gnupg git openssl postgresql nginx clamav clamav-daemon
sed -ri 's/^[#[:space:]]*TCPSocket .*/TCPSocket 3310/' /etc/clamav/clamd.conf
sed -ri 's/^[#[:space:]]*TCPAddr .*/TCPAddr 127.0.0.1/' /etc/clamav/clamd.conf
systemctl enable --now clamav-daemon
systemctl restart clamav-daemon
if ! command -v node >/dev/null || [[ "$(node -p 'process.versions.node.split(".")[0]')" -lt 22 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
corepack enable
corepack prepare pnpm@9.12.0 --activate

echo "==> User and directories"
id -u auction >/dev/null 2>&1 || useradd --system --home /srv/auction --shell /usr/sbin/nologin auction
install -d -o auction -g auction -m 750 /srv/auction /srv/auction/releases
install -d -o auction -g auction -m 750 /var/lib/auction /var/lib/auction/storage
install -d -o root -g root -m 750 /var/backups/auction
install -d -o root -g auction -m 750 /etc/auction

echo "==> Database"
systemctl enable --now postgresql
if [[ ! -f "$ENV_FILE" ]]; then
  DB_PASSWORD="$(openssl rand -hex 24)"
  sudo -u postgres psql -v ON_ERROR_STOP=1 -v db_password="'${DB_PASSWORD}'" -f "$REPO_DIR/deploy/bootstrap-db.sql"

  echo "==> Writing $ENV_FILE"
  umask 027
  cat >"$ENV_FILE" <<ENV
NODE_ENV=production
PORT=3000
LOG_LEVEL=info
DATABASE_URL=postgres://auction:${DB_PASSWORD}@127.0.0.1:5432/auction
DATABASE_SSL=false
DATABASE_POOL_MAX=20
RUN_MIGRATIONS_ON_BOOT=false

JWT_SECRET=$(openssl rand -hex 32)
JWT_REFRESH_SECRET=$(openssl rand -hex 32)
IP_HASH_PEPPER=$(openssl rand -hex 32)
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# REQUIRED: set these two before the first start.
BOOTSTRAP_SUPER_ADMIN_EMAIL=
CORS_ORIGIN=https://auction.example.et
WEB_BASE_URL=https://auction.example.et

# nginx is the only proxy in front of the API.
TRUST_PROXY_HOPS=1
SUBMISSION_RATE_WINDOW_MS=900000
SUBMISSION_RATE_LIMIT_MAX=5

STORAGE_DRIVER=filesystem
STORAGE_DIR=/var/lib/auction/storage
FILE_SCAN_ENABLED=true
CLAMAV_HOST=127.0.0.1
CLAMAV_PORT=3310
FILE_SCAN_TIMEOUT_MS=15000

PII_ENCRYPTION_KEY=$(openssl rand -hex 32)
PII_HASH_SECRET=$(openssl rand -hex 32)
SETTLEMENT_DUE_HOURS=72

# Fill these from the Chapa dashboard to enable digital deposits/refunds.
CHAPA_SECRET_KEY=
CHAPA_PUBLIC_KEY=
CHAPA_WEBHOOK_SECRET=

# Password-reset links and notifications are emailed. Without SMTP they are
# only logged, so users cannot recover their accounts.
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
MAIL_FROM=no-reply@auction.example.et

AI_PROVIDER=auto
AI_TIMEOUT_MS=15000
GEMINI_API_KEY=
GEMINI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
GEMINI_MODEL=gemini-flash-latest
OPENROUTER_API_KEY=
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_MODEL=openrouter/free

TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_URL=
TELEGRAM_WEBHOOK_SECRET=
TELEGRAM_POLLING=false
ENV
  chown root:auction "$ENV_FILE"
  chmod 640 "$ENV_FILE"
else
  echo "    $ENV_FILE exists; leaving secrets untouched."
fi

echo "==> systemd"
install -m 644 "$REPO_DIR/deploy/auction-api.service" /etc/systemd/system/auction-api.service
systemctl daemon-reload
systemctl enable auction-api

echo "==> Nightly backup (02:30)"
install -m 750 "$REPO_DIR/deploy/backup.sh" /usr/local/sbin/auction-backup
echo "30 2 * * * root /usr/local/sbin/auction-backup >> /var/log/auction-backup.log 2>&1" >/etc/cron.d/auction-backup

cat <<NEXT

Provisioning done. Next:
  1. Edit $ENV_FILE: set BOOTSTRAP_SUPER_ADMIN_EMAIL, CORS_ORIGIN, WEB_BASE_URL, SMTP_*,
     and Gemini/OpenRouter API keys if AI assistance should be enabled.
     Back the file up somewhere safe.
  2. sudo bash deploy/deploy.sh
  3. Configure nginx + TLS (packages/api/README.md, "TLS").
NEXT
