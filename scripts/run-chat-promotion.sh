#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

set -a
source ./.env
set +a
: "${TELEGRAM_WEBHOOK_SECRET:?Missing Telegram worker secret}"

curl --fail --silent --show-error --connect-timeout 5 --max-time 840 \
  -X POST \
  -H "x-telegram-bot-api-secret-token: ${TELEGRAM_WEBHOOK_SECRET}" \
  "${AUTOMART_LOOPBACK_URL:-http://127.0.0.1:4001}/api/telegram/chat-promotion"
echo
