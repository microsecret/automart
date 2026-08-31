#!/usr/bin/env bash
set -euo pipefail

# Один прогон сбора АЗС с внешних источников. Скрейпер обходит целевые
# регионы последовательно с паузой, чтобы не упереться в защиту источника.
cd "$(dirname "$0")/.."
set -a
# The production .env is managed on the server and is never committed.
source ./.env
set +a

: "${PARSER_TOKEN:?PARSER_TOKEN must be configured on the server}"
BASE_URL="${AUTOMART_INTERNAL_URL:-http://127.0.0.1:4001}"
# Приложение может перезапускаться ровно в момент cron. Повторы — только к
# loopback-API и не увеличивают частоту обращений к источникам.
CURL=(curl --fail --silent --show-error --connect-timeout 10 --max-time 300
  --retry 2 --retry-all-errors --retry-delay 5 --retry-max-time 30
  -H "Authorization: Bearer ${PARSER_TOKEN}" -H "Content-Type: application/json")

FAILED_STAGES=0

run_source() {
  local label="$1"
  local payload="$2"
  echo "[$(date -Is)] ${label}"
  if ! "${CURL[@]}" -X POST "${BASE_URL}/api/parser/fuel/sync" --data "${payload}"; then
    echo
    echo "[$(date -Is)] ERROR: ${label} failed; continuing" >&2
    FAILED_STAGES=$((FAILED_STAGES + 1))
  fi
  echo
}

# ГдеБЕНЗ — цены и наличие по целевым городам и областям.
run_source "Fuel: GdeBenz" '{"source":"GDEBENZ"}'
# ГдеЗаправка — справочник точек и наличие топлива.
run_source "Fuel: GdeZapravka" '{"source":"GDEZAPRAVKA"}'

echo "[$(date -Is)] Fuel scraper completed"

if (( FAILED_STAGES > 0 )); then
  echo "[$(date -Is)] Fuel scraper completed with ${FAILED_STAGES} failed stage(s)" >&2
  exit 1
fi
