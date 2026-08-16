#!/usr/bin/env bash
set -euo pipefail

# Kept idempotent so deploys replace, rather than duplicate, the tagged entry.
# CBR publishes one official snapshot per business day; retrying every six
# hours makes a temporary network outage self-healing without burdening the
# source or waiting for the next deployment.
JOB="17 */6 * * * cd /root/AutoMart && /usr/bin/flock -n /tmp/automart-auction-rates.lock /usr/bin/node scripts/refresh-auction-rates.mjs >> /var/log/automart-auction-rates.log 2>&1 # automart-auction-rates"
CURRENT="$(crontab -l 2>/dev/null || true)"
FILTERED="$(printf '%s\n' "$CURRENT" | grep -vF "# automart-auction-rates" || true)"

printf '%s\n%s\n' "$FILTERED" "$JOB" | crontab -
echo "Installed automart auction-rate cron"
