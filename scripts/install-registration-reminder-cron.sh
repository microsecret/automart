#!/usr/bin/env bash
set -euo pipefail

# Запуск раз в час. Само приложение решает, кому уже пора писать, поэтому
# частый вызов ничего лишнего не рассылает — он лишь сокращает задержку.
#
# Скрипт идемпотентен: повторный запуск заменяет запись, а не плодит копии.
JOB="41 * * * * cd /root/AutoMart && /usr/bin/flock -n /tmp/automart-registration-reminders.lock bash scripts/run-registration-reminders.sh >> /var/log/automart-registration-reminders.log 2>&1 # automart-registration-reminders"
# shellcheck source=scripts/cron-install-lib.sh
source "$(dirname "$0")/cron-install-lib.sh"

replace_cron_job "# automart-registration-reminders" "$JOB"
echo "Installed automart registration-reminder cron"
