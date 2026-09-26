#!/usr/bin/env bash
# Builds and releases the API and web app.
#
#   sudo bash deploy/deploy.sh              # deploy the current checkout (HEAD)
#   sudo bash deploy/deploy.sh --ref main   # deploy a git ref
#
# Each release is built in its own directory under /srv/auction/releases.
# Migrations run BEFORE the switch; the `current` symlink then flips, the
# service restarts, and /health/ready is polled. If the new release does not
# become ready, the symlink flips back and the previous release restarts.
# Migrations are not rolled back: apply the matching .down.sql by hand.
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "Run as root (sudo)." >&2
  exit 1
fi

REF=HEAD
while [[ $# -gt 0 ]]; do
  case "$1" in
    --ref) REF="$2"; shift 2 ;;
    *) echo "Unknown argument: $1" >&2; exit 1 ;;
  esac
done

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_ROOT=/srv/auction
ENV_FILE=/etc/auction/api.env
KEEP_RELEASES=5
RELEASE="$APP_ROOT/releases/$(date +%Y%m%d%H%M%S)"
PREVIOUS="$(readlink -f "$APP_ROOT/current" 2>/dev/null || true)"

grep -q '^BOOTSTRAP_SUPER_ADMIN_EMAIL=.\+' "$ENV_FILE" || {
  echo "BOOTSTRAP_SUPER_ADMIN_EMAIL is empty in $ENV_FILE; the API refuses to start in production without it." >&2
  exit 1
}

as_app() { sudo -u auction -H bash -c "$1"; }
with_env() { as_app "set -a; . '$ENV_FILE'; set +a; $1"; }

echo "==> Exporting $REF to $RELEASE"
git -C "$REPO_DIR" fetch --quiet --all 2>/dev/null || true
install -d -o auction -g auction "$RELEASE"
git -C "$REPO_DIR" archive "$REF" | tar -x -C "$RELEASE"
chown -R auction:auction "$RELEASE"

echo "==> Installing and building"
# VITE_API_BASE_URL stays empty: nginx serves web and API on one origin.
as_app "cd '$RELEASE' && pnpm install --frozen-lockfile && VITE_API_BASE_URL= pnpm build"

echo "==> Migrating"
with_env "cd '$RELEASE/packages/api' && node dist/infrastructure/database/migrations/run.js"

echo "==> Switching release"
ln -sfn "$RELEASE" "$APP_ROOT/current.new"
mv -T "$APP_ROOT/current.new" "$APP_ROOT/current"
systemctl restart auction-api

echo "==> Waiting for /health/ready"
for _ in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:3000/health/ready >/dev/null 2>&1; then
    echo "    ready"
    ls -1dt "$APP_ROOT"/releases/* | tail -n +$((KEEP_RELEASES + 1)) | xargs -r rm -rf
    systemctl reload nginx 2>/dev/null || true
    echo "Deployed $(git -C "$REPO_DIR" rev-parse --short "$REF")"
    exit 0
  fi
  sleep 2
done

echo "!! New release did not become ready; rolling back." >&2
journalctl -u auction-api -n 50 --no-pager >&2 || true
if [[ -n "$PREVIOUS" && -d "$PREVIOUS" ]]; then
  ln -sfn "$PREVIOUS" "$APP_ROOT/current.new"
  mv -T "$APP_ROOT/current.new" "$APP_ROOT/current"
  systemctl restart auction-api
  echo "Rolled back to $PREVIOUS" >&2
fi
exit 1
