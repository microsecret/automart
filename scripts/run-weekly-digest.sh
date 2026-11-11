#!/usr/bin/env bash
set -euo pipefail

# Cron проверяет расписание раз в минуту, очередь обрабатывается каждые семь.
# Следующую дату личного напоминания задача определяет для каждого получателя.
if [[ "${1:-}" == "--scheduled" ]]; then
  now="$(date +%s)"
  if (( (now / 60) % 7 != 0 )); then
    exit 0
  fi
fi

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
