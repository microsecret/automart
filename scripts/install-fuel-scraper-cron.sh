#!/usr/bin/env bash
set -euo pipefail

# Сбор АЗС каждые 15 минут: данные на карте всегда свежие.
#
# flock не даёт двум прогонам пересечься. Это здесь несущее, а не
# страховочное: полный обход регионов занимает больше 15 минут, поэтому
# часть запусков будет попадать на идущий прогон и обязана молча уйти —
# иначе источник получит два скрейпера разом.
JOB="*/15 * * * * cd /root/AutoMart && /usr/bin/flock -n /tmp/automart-fuel-scraper.lock /bin/bash scripts/run-fuel-scraper.sh >> /var/log/automart-fuel-scraper.log 2>&1 # automart-fuel-scraper"
# shellcheck source=scripts/cron-install-lib.sh
source "$(dirname "$0")/cron-install-lib.sh"

replace_cron_job "# automart-fuel-scraper" "$JOB"
echo "Installed automart fuel scraper cron"
