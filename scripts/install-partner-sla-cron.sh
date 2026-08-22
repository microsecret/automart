#!/usr/bin/env bash
set -euo pipefail

# Пропущенное предложение становится пропущенным только по истечении срока,
# поэтому показатели меняются и без действий партнёров. Пересчёт раз в час
# держит распределение заявок в соответствии с реальным поведением.
#
# Kept idempotent so deploys replace, rather than duplicate, the tagged entry.
JOB="27 * * * * cd /root/AutoMart && /usr/bin/flock -n /tmp/automart-partner-sla.lock /usr/bin/node scripts/refresh-partner-sla.mjs >> /var/log/automart-partner-sla.log 2>&1 # automart-partner-sla"
# shellcheck source=scripts/cron-install-lib.sh
source "$(dirname "$0")/cron-install-lib.sh"

replace_cron_job "# automart-partner-sla" "$JOB"
echo "Installed automart partner SLA cron"
