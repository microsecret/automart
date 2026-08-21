#!/usr/bin/env bash
set -euo pipefail

# Раз в три часа: чаще люди воспринимают уведомления как назойливость, реже —
# перестают быть полезными, потому что интересный лот уже забрали.
#
# Скрипт идемпотентен: повторный запуск заменяет запись, а не плодит копии.
JOB="13 */3 * * * cd /root/AutoMart && /usr/bin/flock -n /tmp/automart-saved-search.lock bash scripts/run-saved-search-notify.sh >> /var/log/automart-saved-search.log 2>&1 # automart-saved-search"
CURRENT="$(crontab -l 2>/dev/null || true)"
FILTERED="$(printf '%s\n' "$CURRENT" | grep -vF "# automart-saved-search" || true)"

printf '%s\n%s\n' "$FILTERED" "$JOB" | crontab -
echo "Installed automart saved-search cron"
