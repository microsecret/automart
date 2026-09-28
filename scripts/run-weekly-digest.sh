#!/usr/bin/env bash
set -euo pipefail

# Еженедельное письмо в боте. Запускается раз в день; кому пора — решает
# сама задача (неделя у каждого своя). Без --retry: повтор запроса после
# обрыва мог бы написать людям дважды — задача и так отмечает каждого до
# отправки, а недошедших подберёт завтрашний запуск.
cd "$(dirname "$0")/.."
set -a
source ./.env
set +a

BASE_URL="${AUTOMART_INTERNAL_URL:-http://127.0.0.1:4001}"

echo "[$(date -Is)] Weekly digest"
curl --fail --silent --show-error --connect-timeout 10 --max-time 600 \
  -X POST \
  -H "x-telegram-bot-api-secret-token: ${TELEGRAM_WEBHOOK_SECRET}" \
  "${BASE_URL}/api/telegram/weekly-digest"
echo
