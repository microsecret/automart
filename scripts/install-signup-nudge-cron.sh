#!/usr/bin/env bash
set -euo pipefail

# Раз в сутки в 12:20 по серверному времени.
#
# Сама рассылка идёт раз в две недели на человека — проверять чаще незачем,
# а полдень выбран потому, что сообщение о продаже машины читают днём, а не
# ночью.
JOB="20 12 * * * cd /root/AutoMart && /usr/bin/flock -n /tmp/automart-signup-nudge.lock bash scripts/run-signup-nudges.sh >> /var/log/automart-signup-nudge.log 2>&1 # automart-signup-nudge"
# shellcheck source=scripts/cron-install-lib.sh
source "$(dirname "$0")/cron-install-lib.sh"

replace_cron_job "# automart-signup-nudge" "$JOB"
echo "Installed automart signup-nudge cron"
