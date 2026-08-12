#!/usr/bin/env bash
set -euo pipefail

# This bounded, serialized job uses Encar's public HTML only. It intentionally
# uses one declared service identity and does not rotate proxies or headers.
cd "$(dirname "$0")/.."
set -a
# The production .env is managed on the server and is never committed.
source ./.env
set +a

: "${PARSER_TOKEN:?PARSER_TOKEN must be configured on the server}"
BASE_URL="${AUTOMART_INTERNAL_URL:-http://127.0.0.1:4000}"
CURL=(curl --fail --silent --show-error --connect-timeout 10 --max-time 180
  -H "Authorization: Bearer ${PARSER_TOKEN}" -H "Content-Type: application/json")

echo "[$(date -Is)] Encar discovery"
"${CURL[@]}" -X POST "${BASE_URL}/api/parser/encar/sync" --data '{"limit":5}'
echo
echo "[$(date -Is)] Encar freshness refresh"
"${CURL[@]}" -X POST "${BASE_URL}/api/parser/encar/refresh" --data '{"limit":5}'
echo
