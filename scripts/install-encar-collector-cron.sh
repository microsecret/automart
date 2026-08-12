#!/usr/bin/env bash
set -euo pipefail

# One bounded run every 20 minutes; flock prevents duplicate source traffic
# when an earlier run is still in progress.
JOB="*/20 * * * * cd /root/AutoMart && /usr/bin/flock -n /tmp/automart-encar-collector.lock /bin/bash scripts/run-encar-collector.sh >> /var/log/automart-encar-collector.log 2>&1 # automart-encar-collector"
CURRENT="$(crontab -l 2>/dev/null || true)"

if ! grep -Fq "# automart-encar-collector" <<< "$CURRENT"; then
  printf '%s\n%s\n' "$CURRENT" "$JOB" | crontab -
  echo "Installed automart Encar collector cron"
else
  echo "Automart Encar collector cron already installed"
fi
