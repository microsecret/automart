#!/usr/bin/env bash
set -euo pipefail

# Bounded, serialized source collection. The application rotates only the
# explicitly configured shared proxy pool and applies per-proxy caps/cooldowns.
cd "$(dirname "$0")/.."
set -a
# The production .env is managed on the server and is never committed.
source ./.env
set +a

: "${PARSER_TOKEN:?PARSER_TOKEN must be configured on the server}"
BASE_URL="${AUTOMART_INTERNAL_URL:-http://127.0.0.1:4000}"
# The application may be restarting for a deployment exactly when the cron
# fires.  A few local retries keep this bounded collector from losing the
# whole refresh cycle because of one short-lived 502/reset.  The retry is only
# against our loopback API; it never increases source-site request parallelism.
CURL=(curl --fail --silent --show-error --connect-timeout 10 --max-time 240
  --retry 3 --retry-all-errors --retry-delay 3
  -H "Authorization: Bearer ${PARSER_TOKEN}" -H "Content-Type: application/json")

echo "[$(date -Is)] Encar discovery"
"${CURL[@]}" -X POST "${BASE_URL}/api/parser/encar/sync" --data '{"limit":5}'
echo
echo "[$(date -Is)] Encar freshness refresh"
# The endpoint processes source pages serially. 40 checks per cycle cover the
# current catalogue in under seven hours while keeping the source request rate
# bounded and independent of proxies or header rotation.
"${CURL[@]}" -X POST "${BASE_URL}/api/parser/encar/refresh" --data '{"limit":40}'
echo
echo "[$(date -Is)] K Car discovery"
"${CURL[@]}" -X POST "${BASE_URL}/api/parser/kcar/sync" --data '{"limit":8}'
echo
echo "[$(date -Is)] K Car freshness refresh"
"${CURL[@]}" -X POST "${BASE_URL}/api/parser/kcar/refresh" --data '{"limit":40}'
echo
if [[ -n "${MOBILE_DE_API_USERNAME:-}" && -n "${MOBILE_DE_API_PASSWORD:-}" ]]; then
  echo "[$(date -Is)] mobile.de official API discovery"
  "${CURL[@]}" -X POST "${BASE_URL}/api/parser/mobile-de/sync" --data '{"limit":5}'
  echo
  echo "[$(date -Is)] mobile.de freshness refresh"
  "${CURL[@]}" -X POST "${BASE_URL}/api/parser/mobile-de/refresh" --data '{"limit":30}'
  echo
fi
echo "[$(date -Is)] Configured partner/API feeds"
"${CURL[@]}" -X POST "${BASE_URL}/api/parser/partner-feeds/sync" --data '{}'
echo
