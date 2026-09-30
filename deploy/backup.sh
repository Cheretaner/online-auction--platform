#!/usr/bin/env bash
# Nightly backup of the database and uploaded documents (KYC and deposit
# proofs live only on disk). Keeps 14 days. Installed by provision.sh as
# /usr/local/sbin/auction-backup with a cron entry.
#
# Copy /var/backups/auction off the machine as well: a backup on the same
# disk does not survive losing the server.
#
# Restore (on a stopped service):
#   sudo -u postgres pg_restore --clean --if-exists -d auction <file>.dump
#   sudo tar -xzf <file>-storage.tar.gz -C /
set -euo pipefail

DEST=/var/backups/auction
STAMP="$(date +%Y%m%d-%H%M%S)"
KEEP_DAYS=14

install -d -m 750 "$DEST"
sudo -u postgres pg_dump --format=custom --file="/tmp/auction-$STAMP.dump" auction
mv "/tmp/auction-$STAMP.dump" "$DEST/auction-$STAMP.dump"
tar -czf "$DEST/auction-$STAMP-storage.tar.gz" /var/lib/auction/storage 2>/dev/null

find "$DEST" -type f -mtime +"$KEEP_DAYS" -delete
echo "$(date -Is) backup ok: $DEST/auction-$STAMP.*"
