#!/usr/bin/env bash
set -euo pipefail

# Скрипт проверяет интервал в семь минут независимо от границ часа.
JOB="* * * * * cd /root/AutoMart && /usr/bin/flock -n /tmp/automart-weekly-digest.lock bash scripts/run-weekly-digest.sh --scheduled >> /var/log/automart-weekly-digest.log 2>&1 # automart-weekly-digest"
source "$(dirname "$0")/cron-install-lib.sh"

replace_cron_job "# automart-weekly-digest" "$JOB"
remove_cron_job "# automart-registration-reminders"
remove_cron_job "# automart-signup-nudge"
echo "Installed automart weekly digest cron"
