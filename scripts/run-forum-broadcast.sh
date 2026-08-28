#!/usr/bin/env bash
set -euo pipefail

# Обсуждения форума в чаты сети.
#
# Какую тему и в какой чат, решает приложение: не чаще одной в сутки на
# чат, только свежие темы с ответами. Здесь только регулярный вызов.
cd "$(dirname "$0")/.."
set -a
# Продакшн-.env живёт на сервере и не коммитится.
source ./.env
set +a

BASE_URL="${NEXTAUTH_URL:-http://127.0.0.1:3000}"

# Приложение может перезапускаться из-за деплоя ровно в момент запуска —
# короткий повтор не даёт потерять волну.
curl --fail --silent --show-error --connect-timeout 10 --max-time 120 \
  --retry 3 --retry-all-errors --retry-delay 3 \
  -X POST \
  -H "x-telegram-bot-api-secret-token: ${TELEGRAM_WEBHOOK_SECRET}" \
  "${BASE_URL}/api/telegram/forum-broadcast"
echo
