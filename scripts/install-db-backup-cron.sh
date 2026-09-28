#!/usr/bin/env bash
set -euo pipefail

# Копия базы ежедневно в 03:30 UTC — в самый тихий час, между прогонами сборщиков.
JOB="30 3 * * * cd /root/AutoMart && /usr/bin/flock -n /tmp/automart-db-backup.lock /usr/bin/node scripts/backup-db.mjs >> /var/log/automart-db-backup.log 2>&1 # automart-db-backup"
source "$(dirname "$0")/cron-install-lib.sh"

replace_cron_job "# automart-db-backup" "$JOB"
echo "Installed automart db backup cron"
