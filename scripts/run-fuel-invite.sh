#!/usr/bin/env bash
set -euo pipefail

# Приглашение в карту АЗС по чатам сети.
#
# Карта наличия работает ровно настолько, насколько людей на ней. Кого
# звать и как часто, решает приложение: не чаще раза в трое суток на чат.
# Здесь только регулярный вызов.
cd "$(dirname "$0")/.."
set -a
# Продакшн-.env живёт на сервере и не коммитится.
source ./.env
set +a

BASE_URL="${NEXTAUTH_URL:-http://127.0.0.1:3000}"

curl --fail --silent --show-error --connect-timeout 10 --max-time 120 \
  --retry 3 --retry-all-errors --retry-delay 3 \
  -X POST \
  -H "x-telegram-bot-api-secret-token: ${TELEGRAM_WEBHOOK_SECRET}" \
  "${BASE_URL}/api/telegram/fuel-invite"
echo
