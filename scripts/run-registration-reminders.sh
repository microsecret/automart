#!/usr/bin/env bash
set -euo pipefail

# Напоминания тем, кто начал регистрацию в Telegram и не закончил её.
#
# Кого именно и когда звать, решает приложение: первое напоминание через два
# часа, дальше раз в сутки, максимум три. Здесь только регулярный вызов.
cd "$(dirname "$0")/.."
set -a
# Продакшн-.env живёт на сервере и не коммитится.
source ./.env
set +a

: "${TELEGRAM_WEBHOOK_SECRET:?TELEGRAM_WEBHOOK_SECRET must be configured on the server}"
BASE_URL="${AUTOMART_INTERNAL_URL:-http://127.0.0.1:4001}"

# Приложение может перезапускаться из-за деплоя ровно в момент запуска —
# короткий повтор не даёт потерять волну напоминаний.
curl --fail --silent --show-error --connect-timeout 10 --max-time 120 \
  --retry 3 --retry-all-errors --retry-delay 3 \
  -X POST \
  -H "x-telegram-bot-api-secret-token: ${TELEGRAM_WEBHOOK_SECRET}" \
  "${BASE_URL}/api/telegram/registration-reminders"
echo
