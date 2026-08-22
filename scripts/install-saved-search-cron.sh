#!/usr/bin/env bash
set -euo pipefail

# Раз в три часа: чаще люди воспринимают уведомления как назойливость, реже —
# перестают быть полезными, потому что интересный лот уже забрали.
#
# Скрипт идемпотентен: повторный запуск заменяет запись, а не плодит копии.
JOB="13 */3 * * * cd /root/AutoMart && /usr/bin/flock -n /tmp/automart-saved-search.lock bash scripts/run-saved-search-notify.sh >> /var/log/automart-saved-search.log 2>&1 # automart-saved-search"
# shellcheck source=scripts/cron-install-lib.sh
source "$(dirname "$0")/cron-install-lib.sh"

replace_cron_job "# automart-saved-search" "$JOB"
echo "Installed automart saved-search cron"
