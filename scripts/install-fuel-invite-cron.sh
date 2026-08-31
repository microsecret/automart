#!/usr/bin/env bash
set -euo pipefail

# Приглашение в карту АЗС уходит в чаты каждые шесть часов.
#
# Задание запускается втрое чаще самого интервала — раз в три часа. Так
# сделано нарочно: чат получает пост не чаще раза в шесть часов, и решает
# это приложение, а частый запуск нужен, чтобы новый чат в сети и чат,
# пропустивший волну из-за сбоя, дождались следующей попытки быстро, а не
# через полные шесть часов.
#
# Частоту можно менять без правки кода: FUEL_INVITE_INTERVAL_HOURS в
# server env. Нужный темп виден только по реакции чатов.
#
# Минута 47 свободна: остальные задания стоят на 8, 13, 15, 17, 20, 27,
# 35, 41 и 53.
#
# Kept idempotent so deploys replace, rather than duplicate, the tagged entry.
JOB="47 */3 * * * cd /root/AutoMart && /usr/bin/flock -n /tmp/automart-fuel-invite.lock bash scripts/run-fuel-invite.sh >> /var/log/automart-fuel-invite.log 2>&1 # automart-fuel-invite"
# shellcheck source=scripts/cron-install-lib.sh
source "$(dirname "$0")/cron-install-lib.sh"

replace_cron_job "# automart-fuel-invite" "$JOB"
echo "Installed automart fuel invite cron"
