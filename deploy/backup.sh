#!/usr/bin/env bash
# Nightly backup of the database and uploaded documents (KYC and deposit
# proofs live only on disk). Keeps 14 days. Installed by provision.sh as
# /usr/local/sbin/auction-backup with a cron entry.
#
# Copy /var/backups/auction off the machine as well: a backup on the same
# disk does not survive losing the server.
#
# Restore (on a stopped service):
#   sudo install -o postgres -g postgres -m 600 <file>.dump /var/lib/postgresql/auction-restore.dump
#   sudo -u postgres pg_restore --clean --if-exists -d auction /var/lib/postgresql/auction-restore.dump
#   sudo tar -xzf <file>-storage.tar.gz -C /var/lib/auction
set -euo pipefail
umask 077

DEST=/var/backups/auction
STAMP="$(date +%Y%m%d-%H%M%S)"
KEEP_DAYS=14
LOCK=/run/lock/auction-backup.lock

install -d -m 750 "$DEST"
exec 9>"$LOCK"
if ! flock -n 9; then
  echo "$(date -Is) backup skipped: another backup is running"
  exit 0
fi

STAGING="$(mktemp -d "$DEST/.staging-$STAMP.XXXXXX")"
trap 'rm -rf "$STAGING"' EXIT

sudo -u postgres pg_dump --format=custom auction > "$STAGING/auction-$STAMP.dump"
pg_restore --list "$STAGING/auction-$STAMP.dump" >/dev/null
tar -czf "$STAGING/auction-$STAMP-storage.tar.gz" -C /var/lib/auction storage
tar -tzf "$STAGING/auction-$STAMP-storage.tar.gz" >/dev/null
(cd "$STAGING" && sha256sum "auction-$STAMP.dump" "auction-$STAMP-storage.tar.gz" > SHA256SUMS)

# Publish only complete archives; the staging directory is private (umask 077).
mv "$STAGING/auction-$STAMP.dump" "$DEST/auction-$STAMP.dump"
mv "$STAGING/auction-$STAMP-storage.tar.gz" "$DEST/auction-$STAMP-storage.tar.gz"
mv "$STAGING/SHA256SUMS" "$DEST/auction-$STAMP-SHA256SUMS"

find "$DEST" -type f -mtime +"$KEEP_DAYS" -delete
echo "$(date -Is) backup ok and verified: $DEST/auction-$STAMP.*"
