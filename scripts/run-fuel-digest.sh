#!/usr/bin/env bash
set -euo pipefail

# Утренняя сводка по топливу в чаты сети.
#
# Что и куда, решает приложение: не чаще раза в сутки на чат, только
# города, только свежие отметки. Здесь только регулярный вызов.
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
  "${BASE_URL}/api/telegram/fuel-digest"
echo
