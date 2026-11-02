#!/usr/bin/env bash
set -euo pipefail
# Repair missed queue entries from recorded campaign IDs; never sends messages.
source "$(dirname "$0")/cron-install-lib.sh"
JOB="*/5 * * * * cd /root/AutoMart && /usr/bin/flock -n /tmp/automart-telegram-cleanup-reconcile.lock /usr/bin/node --env-file=.env scripts/reconcile-telegram-cleanup.mjs --apply >> /var/log/automart-telegram-cleanup-reconcile.log 2>&1 # automart-telegram-cleanup-reconcile"
replace_cron_job "# automart-telegram-cleanup-reconcile" "$JOB"
echo "Installed Telegram cleanup reconciliation cron"
