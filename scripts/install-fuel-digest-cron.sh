#!/usr/bin/env bash
set -euo pipefail

# Сводка по топливу уходит в чаты в восемь утра по Москве.
#
# Время выбрано под дорогу на работу: человек читает чат перед выездом и
# уже знает, куда заезжать. Вечером та же сводка бесполезна — топливо к
# ночи разберут, а утром привезут новое.
#
# Сервер живёт по UTC, поэтому 05:00 — это 08:00 в Москве.
#
# Минута 5 свободна: остальные задания стоят на 8, 13, 15, 17, 20, 27,
# 35, 41, 47 и 53.
#
# Kept idempotent so deploys replace, rather than duplicate, the tagged entry.
JOB="5 5 * * * cd /root/AutoMart && /usr/bin/flock -n /tmp/automart-fuel-digest.lock bash scripts/run-fuel-digest.sh >> /var/log/automart-fuel-digest.log 2>&1 # automart-fuel-digest"
# shellcheck source=scripts/cron-install-lib.sh
source "$(dirname "$0")/cron-install-lib.sh"

replace_cron_job "# automart-fuel-digest" "$JOB"
echo "Installed automart fuel digest cron"
