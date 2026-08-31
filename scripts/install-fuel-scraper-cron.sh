#!/usr/bin/env bash
set -euo pipefail

# Сбор АЗС каждые три часа. Источник отдаёт цену с отметкой времени, поэтому
# чаще собирать смысла нет, а реже — цена на карте устаревает.
# flock не даёт двум прогонам пересечься, если предыдущий ещё идёт.
JOB="23 */3 * * * cd /root/AutoMart && /usr/bin/flock -n /tmp/automart-fuel-scraper.lock /bin/bash scripts/run-fuel-scraper.sh >> /var/log/automart-fuel-scraper.log 2>&1 # automart-fuel-scraper"
# shellcheck source=scripts/cron-install-lib.sh
source "$(dirname "$0")/cron-install-lib.sh"

replace_cron_job "# automart-fuel-scraper" "$JOB"
echo "Installed automart fuel scraper cron"
