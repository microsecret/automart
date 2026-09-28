#!/usr/bin/env bash
set -euo pipefail

# Ежедневно в 08:05 UTC (11:05 по Москве): письмо уходит утром, а не ночью.
JOB="5 8 * * * cd /root/AutoMart && /usr/bin/flock -n /tmp/automart-weekly-digest.lock bash scripts/run-weekly-digest.sh >> /var/log/automart-weekly-digest.log 2>&1 # automart-weekly-digest"
source "$(dirname "$0")/cron-install-lib.sh"

replace_cron_job "# automart-weekly-digest" "$JOB"
echo "Installed automart weekly digest cron"
