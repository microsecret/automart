#!/usr/bin/env bash
set -euo pipefail

# Приглашение в карту АЗС уходит в чаты раз в сутки.
#
# Само задание запускается ежедневно, но чат получает пост не чаще раза в
# трое суток — это решает приложение. Ежедневный запуск нужен, чтобы новый
# чат в сети получил приглашение назавтра, а не через трое суток.
#
# Минута 47 свободна: остальные задания стоят на 8, 13, 15, 17, 20, 27,
# 35, 41 и 53.
#
# Kept idempotent so deploys replace, rather than duplicate, the tagged entry.
JOB="47 10 * * * cd /root/AutoMart && /usr/bin/flock -n /tmp/automart-fuel-invite.lock bash scripts/run-fuel-invite.sh >> /var/log/automart-fuel-invite.log 2>&1 # automart-fuel-invite"
# shellcheck source=scripts/cron-install-lib.sh
source "$(dirname "$0")/cron-install-lib.sh"

replace_cron_job "# automart-fuel-invite" "$JOB"
echo "Installed automart fuel invite cron"
