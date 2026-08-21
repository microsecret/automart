#!/usr/bin/env bash
set -euo pipefail

# Уведомления по сохранённым поискам: кому и что отправлять, решает
# приложение — здесь только регулярный вызов.
cd "$(dirname "$0")/.."
set -a
source ./.env
set +a

: "${TELEGRAM_WEBHOOK_SECRET:?TELEGRAM_WEBHOOK_SECRET must be configured on the server}"
BASE_URL="${AUTOMART_INTERNAL_URL:-http://127.0.0.1:4001}"

curl --fail --silent --show-error --connect-timeout 10 --max-time 180 \
  --retry 3 --retry-all-errors --retry-delay 3 \
  -X POST \
  -H "x-telegram-bot-api-secret-token: ${TELEGRAM_WEBHOOK_SECRET}" \
  "${BASE_URL}/api/saved-searches/notify"
echo
