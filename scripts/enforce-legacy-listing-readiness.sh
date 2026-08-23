#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
set -a
# Production secrets remain server-side and are never copied into the repo.
source ./.env
set +a

: "${PARSER_TOKEN:?PARSER_TOKEN must be configured on the server}"
BASE_URL="${AUTOMART_INTERNAL_URL:-http://127.0.0.1:4001}"

echo "[$(date -Is)] Checking legacy vehicle publication readiness"
curl --fail --silent --show-error \
  --connect-timeout 10 \
  --max-time 120 \
  -X POST "${BASE_URL}/api/parser/listings/readiness" \
  -H "Authorization: Bearer ${PARSER_TOKEN}" \
  -H "Content-Type: application/json" \
  --data '{"apply":true}'
echo
