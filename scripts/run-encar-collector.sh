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
BASE_URL="${AUTOMART_INTERNAL_URL:-http://127.0.0.1:4001}"
# The application may be restarting for a deployment exactly when the cron
# fires.  A few local retries keep this bounded collector from losing the
# whole refresh cycle because of one short-lived 502/reset.  The retry is only
# against our loopback API; it never increases source-site request parallelism.
CURL=(curl --fail --silent --show-error --connect-timeout 10 --max-time 240
  --retry 3 --retry-all-errors --retry-delay 3
  -H "Authorization: Bearer ${PARSER_TOKEN}" -H "Content-Type: application/json")
FAILED_STAGES=0

run_stage() {
  local label="$1"
  local endpoint="$2"
  local payload="$3"
  echo "[$(date -Is)] ${label}"
  if ! "${CURL[@]}" -X POST "${BASE_URL}${endpoint}" --data "${payload}"; then
    echo
    echo "[$(date -Is)] ERROR: ${label} failed; continuing with the remaining sources" >&2
    FAILED_STAGES=$((FAILED_STAGES + 1))
  fi
  echo
}

run_stage "Encar discovery" "/api/parser/encar/sync" '{"limit":5}'
# The endpoint processes due source pages serially. Its database cutoff keeps
# the source request rate bounded and independent of cron frequency.
run_stage "Encar freshness refresh" "/api/parser/encar/refresh" '{"limit":40}'
run_stage "K Car discovery" "/api/parser/kcar/sync" '{"limit":8}'
run_stage "K Car freshness refresh" "/api/parser/kcar/refresh" '{"limit":40}'
run_stage "China Iautos discovery" "/api/parser/public/IAUTOS/sync" '{"limit":5}'
run_stage "China Iautos freshness refresh" "/api/parser/public/IAUTOS/refresh" '{"limit":30}'
run_stage "China YouXinPai discovery" "/api/parser/public/YOUXINPAI/sync" '{"limit":5}'
# One stale YouXinPai item may require a bounded 50-page catalogue scan. Ten
# items per run keep the lock responsive while three runs per hour still cover
# the current production inventory before its three-hour refresh boundary.
run_stage "China YouXinPai freshness refresh" "/api/parser/public/YOUXINPAI/refresh" '{"limit":10}'
run_stage "Korea Bobaedream discovery" "/api/parser/public/BOBAEDREAM/sync" '{"limit":4}'
run_stage "Korea Bobaedream freshness refresh" "/api/parser/public/BOBAEDREAM/refresh" '{"limit":25}'
run_stage "Japan Goo-net discovery" "/api/parser/public/GOONET/sync" '{"limit":5}'
run_stage "Japan Goo-net freshness refresh" "/api/parser/public/GOONET/refresh" '{"limit":30}'
run_stage "Japan BE FORWARD discovery" "/api/parser/public/BEFORWARD/sync" '{"limit":4}'
run_stage "Japan BE FORWARD freshness refresh" "/api/parser/public/BEFORWARD/refresh" '{"limit":25}'
run_stage "Japan CarSensor discovery" "/api/parser/public/CARSENSOR/sync" '{"limit":4}'
run_stage "Japan CarSensor freshness refresh" "/api/parser/public/CARSENSOR/refresh" '{"limit":25}'
run_stage "Europe Carvago discovery" "/api/parser/public/CARVAGO/sync" '{"limit":5}'
run_stage "Europe Carvago freshness refresh" "/api/parser/public/CARVAGO/refresh" '{"limit":30}'
run_stage "Europe AutoSale discovery" "/api/parser/public/AUTOSALE/sync" '{"limit":4}'
run_stage "Europe AutoSale freshness refresh" "/api/parser/public/AUTOSALE/refresh" '{"limit":25}'
if [[ -n "${MOBILE_DE_API_USERNAME:-}" && -n "${MOBILE_DE_API_PASSWORD:-}" ]]; then
  run_stage "mobile.de official API discovery" "/api/parser/mobile-de/sync" '{"limit":5}'
  run_stage "mobile.de freshness refresh" "/api/parser/mobile-de/refresh" '{"limit":30}'
fi
run_stage "Configured partner/API feeds" "/api/parser/partner-feeds/sync" '{}'

if [[ -n "${TELEGRAM_AUCTION_CHAT_IDS:-}" ]]; then
  echo "[$(date -Is)] Telegram auction highlights"
  if ! node ./scripts/publish-auction-highlights.mjs --limit "${TELEGRAM_AUCTION_POST_LIMIT:-3}"; then
    echo "[$(date -Is)] ERROR: Telegram auction highlights failed; collector data is preserved" >&2
    FAILED_STAGES=$((FAILED_STAGES + 1))
  fi
fi

if (( FAILED_STAGES > 0 )); then
  echo "[$(date -Is)] Collector completed with ${FAILED_STAGES} failed stage(s)" >&2
  exit 1
fi
