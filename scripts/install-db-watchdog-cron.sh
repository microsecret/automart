#!/usr/bin/env bash
set -euo pipefail

# Сторож зависшей блокировки базы — раз в две минуты. Сам по себе он почти
# всегда выходит молча: журнала записи нет, проверять нечего.
JOB="*/2 * * * * cd /root/AutoMart && /usr/bin/flock -n /tmp/automart-db-watchdog.lock bash scripts/db-lock-watchdog.sh >> /var/log/automart-db-watchdog.log 2>&1 # automart-db-watchdog"
source "$(dirname "$0")/cron-install-lib.sh"

replace_cron_job "# automart-db-watchdog" "$JOB"
echo "Installed automart db watchdog cron"
