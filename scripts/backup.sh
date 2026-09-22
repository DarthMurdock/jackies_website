#!/usr/bin/env bash
# Daily backup for Jackie's Whimsical Collection.
#
# Backs up the only two things that hold real content — data/content.json
# (all the site's text) and public/uploads/ (every photo Jackie's added) —
# into a single timestamped .tar.gz, dropped into BACKUP_DIR. Old backups
# past KEEP_DAYS are cleaned up automatically so this doesn't quietly fill
# the disk over months of daily runs.
#
# Usage: ./backup.sh
# Meant to be run daily from cron — see README.md for the crontab line.

set -euo pipefail

PROJECT_DIR="/mnt/PI_Projects/jackies-collection"
BACKUP_DIR="/mnt/PI_Staging/backups/jackie_backup"
KEEP_DAYS=30

TIMESTAMP="$(date +%Y-%m-%d_%H-%M-%S)"
BACKUP_FILE="$BACKUP_DIR/jackies-collection-backup-$TIMESTAMP.tar.gz"
LOG_FILE="$BACKUP_DIR/backup.log"

mkdir -p "$BACKUP_DIR"

if [ ! -f "$PROJECT_DIR/data/content.json" ]; then
  echo "$(date '+%Y-%m-%d %H:%M:%S') BACKUP FAILED: $PROJECT_DIR/data/content.json not found" >> "$LOG_FILE"
  exit 1
fi

tar -czf "$BACKUP_FILE" \
  -C "$PROJECT_DIR" \
  data/content.json \
  public/uploads

# Keep only the last KEEP_DAYS days of backups.
find "$BACKUP_DIR" -name "jackies-collection-backup-*.tar.gz" -mtime "+$KEEP_DAYS" -delete

echo "$(date '+%Y-%m-%d %H:%M:%S') backup complete: $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))" >> "$LOG_FILE"

