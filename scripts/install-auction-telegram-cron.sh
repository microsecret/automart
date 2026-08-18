#!/usr/bin/env bash
set -euo pipefail

# Когда лента включена, она подхватывает новые лоты сама: коллектор пополняет
# каталог каждые 20 минут, поэтому публикация раз в час выдерживает поток
# новинок. `flock -n` пропускает запуск, если предыдущий ещё идёт: наложение
# двух прогонов дало бы дубли в канале.
#
# Kept idempotent so deploys replace, rather than duplicate, the tagged entry.
# Автопостинг лотов в чаты отключён по решению владельца: подборка засоряла
# живое общение подписчиков. Задача не удалена, а выключена флагом, поэтому
# включить её обратно можно одной переменной окружения, без правки кода:
#   AUTOMART_AUCTION_TELEGRAM_CRON=on bash scripts/install-auction-telegram-cron.sh
if [ "${AUTOMART_AUCTION_TELEGRAM_CRON:-off}" != "on" ]; then
  crontab -l 2>/dev/null | grep -vF "# automart-auction-telegram" | crontab - 2>/dev/null || true
  echo "Auction Telegram cron is disabled (set AUTOMART_AUCTION_TELEGRAM_CRON=on to enable)"
  exit 0
fi

JOB="8 * * * * cd /root/AutoMart && /usr/bin/flock -n /tmp/automart-auction-telegram.lock /usr/bin/node scripts/publish-auction-highlights.mjs >> /var/log/automart-auction-telegram.log 2>&1 # automart-auction-telegram"
CURRENT="$(crontab -l 2>/dev/null || true)"
FILTERED="$(printf '%s\n' "$CURRENT" | grep -vF "# automart-auction-telegram" || true)"

printf '%s\n%s\n' "$FILTERED" "$JOB" | crontab -
echo "Installed automart auction Telegram cron"
