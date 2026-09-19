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
# fires. A few local retries keep this bounded collector from losing the whole
# refresh cycle because of one short-lived 502/reset. The 30-second retry
# budget is intentionally shorter than one stage: a source timeout after four
# minutes must not replay the same expensive request three more times.
# Retries target only our loopback API and never increase source concurrency.
CURL=(curl --fail --silent --show-error --connect-timeout 10 --max-time 240
  --retry 3 --retry-all-errors --retry-delay 3 --retry-max-time 30
  -H "Authorization: Bearer ${PARSER_TOKEN}" -H "Content-Type: application/json")
FAILED_STAGES=0

# Порядковый номер прогона за сутки: сборщик запускается каждые 20 минут,
# то есть 72 раза. По нему редкие источники пропускают часть циклов.
RUN_SLOT=$(( ($(date +%s) / 1200) % 72 ))

# Прогон источника раз в N циклов вместо каждого.
#
# Замер за неделю: Encar дал 1019 новых лотов, CarSensor 669, KCar 381,
# BeForward 364, YouXinPai 257 — а Iautos 33, Bobaedream 8, Carvago и
# AutoSale по нулю. При этом все они опрашивались одинаково часто, по
# 47-52 раза в сутки каждый.
#
# Прогон целиком занимает 11 минут при интервале запуска в 20 — почти
# всё время сборщик работает. Слабые источники к тому же чаще падают:
# у Iautos 12 отказов на 27 попыток, Carvago отвечает HTTP 403.
#
# Разрежение не выключает источник: он по-прежнему опрашивается, просто
# соразмерно отдаче. Если Carvago снова начнёт отдавать машины, это
# станет видно по числу новых лотов, и цифру можно вернуть.
run_stage_every() {
  local every="$1"; shift
  if (( RUN_SLOT % every != 0 )); then
    echo "[$(date -Is)] $1 — пропуск (раз в ${every} циклов)"
    return 0
  fi
  run_stage "$@"
}

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
run_stage_every 3 "China Iautos discovery" "/api/parser/public/IAUTOS/sync" '{"limit":5}'
run_stage_every 3 "China Iautos freshness refresh" "/api/parser/public/IAUTOS/refresh" '{"limit":30}'
run_stage "China YouXinPai discovery" "/api/parser/public/YOUXINPAI/sync" '{"limit":5}'
# One stale YouXinPai item may require a bounded 50-page catalogue scan. Ten
# items per run keep the lock responsive while three runs per hour still cover
# the current production inventory before its three-hour refresh boundary.
run_stage "China YouXinPai freshness refresh" "/api/parser/public/YOUXINPAI/refresh" '{"limit":10}'
run_stage_every 6 "Korea Bobaedream discovery" "/api/parser/public/BOBAEDREAM/sync" '{"limit":4}'
run_stage_every 6 "Korea Bobaedream freshness refresh" "/api/parser/public/BOBAEDREAM/refresh" '{"limit":25}'
run_stage "Japan Goo-net discovery" "/api/parser/public/GOONET/sync" '{"limit":5}'
run_stage "Japan Goo-net freshness refresh" "/api/parser/public/GOONET/refresh" '{"limit":30}'
run_stage "Japan BE FORWARD discovery" "/api/parser/public/BEFORWARD/sync" '{"limit":4}'
run_stage "Japan BE FORWARD freshness refresh" "/api/parser/public/BEFORWARD/refresh" '{"limit":25}'
run_stage "Japan CarSensor discovery" "/api/parser/public/CARSENSOR/sync" '{"limit":4}'
run_stage "Japan CarSensor freshness refresh" "/api/parser/public/CARSENSOR/refresh" '{"limit":25}'
run_stage_every 12 "Europe Carvago discovery" "/api/parser/public/CARVAGO/sync" '{"limit":5}'
run_stage_every 12 "Europe Carvago freshness refresh" "/api/parser/public/CARVAGO/refresh" '{"limit":30}'
run_stage_every 12 "Europe AutoSale discovery" "/api/parser/public/AUTOSALE/sync" '{"limit":4}'
run_stage_every 12 "Europe AutoSale freshness refresh" "/api/parser/public/AUTOSALE/refresh" '{"limit":25}'
if [[ -n "${MOBILE_DE_API_USERNAME:-}" && -n "${MOBILE_DE_API_PASSWORD:-}" ]]; then
  run_stage "mobile.de official API discovery" "/api/parser/mobile-de/sync" '{"limit":5}'
  run_stage "mobile.de freshness refresh" "/api/parser/mobile-de/refresh" '{"limit":30}'
fi
run_stage "Configured partner/API feeds" "/api/parser/partner-feeds/sync" '{}'

# Сбор данных и внешняя публикация разведены намеренно. Коллектор запускается
# несколько раз в час и не должен превращать каждое обновление источника в
# сообщение. Подборкой управляет только install-auction-telegram-cron.sh.

if (( FAILED_STAGES > 0 )); then
  echo "[$(date -Is)] Collector completed with ${FAILED_STAGES} failed stage(s)" >&2
  exit 1
fi
