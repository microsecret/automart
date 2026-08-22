#!/usr/bin/env bash
set -euo pipefail

# Раз в неделю, ночью с воскресенья на понедельник: удаление старых событий
# посещений держит блокировку записи в SQLite, и делать это в рабочее время
# незачем. Накопление за неделю удаляется за секунды.
#
# Порог — девяносто дней. Сырые события старше трёх месяцев не нужны: отчёты
# за такие периоды никто не строит, а панель показывает месячную статистику.
#
# Скрипт идемпотентен: повторный запуск заменяет запись, а не плодит копии.
JOB="41 4 * * 1 cd /root/AutoMart && /usr/bin/flock -n /tmp/automart-analytics-prune.lock node scripts/prune-analytics-events.mjs >> /var/log/automart-analytics-prune.log 2>&1 # automart-analytics-prune"
# shellcheck source=scripts/cron-install-lib.sh
source "$(dirname "$0")/cron-install-lib.sh"

replace_cron_job "# automart-analytics-prune" "$JOB"
echo "Installed automart analytics-prune cron"
