#!/usr/bin/env bash
set -euo pipefail

# One bounded multi-source run every 20 minutes; flock prevents duplicate traffic
# when an earlier run is still in progress.
JOB="*/20 * * * * cd /root/AutoMart && /usr/bin/flock -n /tmp/automart-encar-collector.lock /bin/bash scripts/run-encar-collector.sh >> /var/log/automart-encar-collector.log 2>&1 # automart-encar-collector"
# shellcheck source=scripts/cron-install-lib.sh
source "$(dirname "$0")/cron-install-lib.sh"

replace_cron_job "# automart-encar-collector" "$JOB"
echo "Installed automart auction collector cron"
