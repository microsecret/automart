#!/usr/bin/env bash
set -euo pipefail

# Когда лента включена, она подхватывает новые лоты отдельно от коллектора.
# Публикация раз в восемь часов не засоряет живые чаты, а `flock -n` пропускает
# запуск, если предыдущий ещё идёт: наложение прогонов дало бы дубли.
#
# Kept idempotent so deploys replace, rather than duplicate, the tagged entry.
# Автопостинг лотов в чаты отключён по решению владельца: подборка засоряла
# живое общение подписчиков. Задача не удалена, а выключена флагом, поэтому
# включить её обратно можно одной переменной окружения, без правки кода:
#   AUTOMART_AUCTION_TELEGRAM_CRON=on bash scripts/install-auction-telegram-cron.sh
# shellcheck source=scripts/cron-install-lib.sh
source "$(dirname "$0")/cron-install-lib.sh"

if [ "${AUTOMART_AUCTION_TELEGRAM_CRON:-off}" != "on" ]; then
  remove_cron_job "# automart-auction-telegram"
  echo "Auction Telegram cron is disabled (set AUTOMART_AUCTION_TELEGRAM_CRON=on to enable)"
  exit 0
fi

JOB="8 */8 * * * cd /root/AutoMart && /usr/bin/flock -n /tmp/automart-auction-telegram.lock /usr/bin/node scripts/publish-auction-highlights.mjs >> /var/log/automart-auction-telegram.log 2>&1 # automart-auction-telegram"
replace_cron_job "# automart-auction-telegram" "$JOB"
echo "Installed automart auction Telegram cron"
