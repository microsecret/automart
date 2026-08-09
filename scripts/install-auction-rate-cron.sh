#!/usr/bin/env bash
set -euo pipefail

# Kept idempotent so deploys do not create duplicate cron entries. The script
# runs from the deployed checkout and writes only the current user's crontab.
JOB="17 7 * * * cd /root/AutoMart && /usr/bin/node scripts/refresh-auction-rates.mjs >> /var/log/automart-auction-rates.log 2>&1 # automart-auction-rates"
CURRENT="$(crontab -l 2>/dev/null || true)"

if ! grep -Fq "# automart-auction-rates" <<< "$CURRENT"; then
  printf '%s\n%s\n' "$CURRENT" "$JOB" | crontab -
  echo "Installed automart auction-rate cron"
else
  echo "Automart auction-rate cron already installed"
fi
