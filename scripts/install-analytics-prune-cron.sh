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
CURRENT="$(crontab -l 2>/dev/null || true)"
FILTERED="$(printf '%s\n' "$CURRENT" | grep -vF "# automart-analytics-prune" || true)"

printf '%s\n%s\n' "$FILTERED" "$JOB" | crontab -
echo "Installed automart analytics-prune cron"
