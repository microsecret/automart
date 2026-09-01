#!/usr/bin/env bash
set -euo pipefail

# Сторож адреса Telegram — каждые пять минут.
#
# Провайдер блокирует адреса Telegram выборочно и меняет, какие именно.
# Сторож молчит, пока связь есть, и переключает адрес, когда текущий
# перестаёт отвечать: без него бот замолкает в чатах и не модерирует, а в
# журнале остаётся только «timed out».
#
# Пять минут — компромисс: блокировка приходит внезапно, и полчаса тишины
# в чатах заметны, а проверка стоит одного HTTP-запроса.
#
# Минута 2 свободна: остальные задания стоят на 5, 8, 13, 15, 17, 20, 23,
# 27, 35, 41, 47 и 53.
JOB="*/5 * * * * cd /root/AutoMart && /usr/bin/flock -n /tmp/automart-telegram-endpoint.lock /bin/bash scripts/telegram-endpoint-guard.sh >> /var/log/automart-telegram-endpoint.log 2>&1 # automart-telegram-endpoint"
# shellcheck source=scripts/cron-install-lib.sh
source "$(dirname "$0")/cron-install-lib.sh"

replace_cron_job "# automart-telegram-endpoint" "$JOB"
echo "Installed automart telegram endpoint guard cron"
