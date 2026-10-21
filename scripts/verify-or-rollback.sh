#!/usr/bin/env bash
# Проверка сайта после перезапуска и откат на прежнюю сборку при провале.
#
# `systemctl is-active` говорит только, что процесс жив. Сайт при этом может
# отдавать 500 или страницу со ссылками на несуществующие стили. Здесь
# проверяется главная, её CSS и динамический каталог с чтением базы.
# --check-only выполняет диагностику без отката и перезапуска.
#
# Заодно это прогрев: первый запрос после перезапуска собирает страницу, и
# живой посетитель получает уже готовую.
set -uo pipefail
cd "$(dirname "$0")/.."

BASE="${AUTOMART_LOCAL_URL:-http://127.0.0.1:4001}"
CHECK_ONLY=false
case "${1:-}" in
  "") ;;
  --check-only) CHECK_ONLY=true ;;
  *) echo "Usage: $0 [--check-only]" >&2; exit 2 ;;
esac
VERIFY_DIR="$(mktemp -d /tmp/automart-verify.XXXXXX)" || exit 1
trap 'rm -f "$VERIFY_DIR/home.html" "$VERIFY_DIR/catalog.json"; rmdir "$VERIFY_DIR"' EXIT
CURL_OPTIONS=(--connect-timeout 3 --max-time 10)

check() {
  local html status css css_status
  for _ in 1 2 3 4 5 6; do
    status="$(curl -s "${CURL_OPTIONS[@]}" -o "$VERIFY_DIR/home.html" -w '%{http_code}' "$BASE/")"
    [ "$status" = "200" ] && break
    sleep 5
  done
  [ "$status" = "200" ] || { echo "verify: главная ответила $status"; return 1; }
  css="$(grep -o '/_next/static/css/[a-zA-Z0-9]*\.css' "$VERIFY_DIR/home.html" | head -1)"
  [ -n "$css" ] || { echo "verify: в разметке главной нет стилей"; return 1; }
  css_status="$(curl -s "${CURL_OPTIONS[@]}" -o /dev/null -w '%{http_code}' "$BASE$css")"
  [ "$css_status" = "200" ] || { echo "verify: стиль $css ответил $css_status"; return 1; }
  local catalog_status
  catalog_status="$(curl -s "${CURL_OPTIONS[@]}" -o "$VERIFY_DIR/catalog.json" -w '%{http_code}' "$BASE/api/listings?limit=1")"
  [ "$catalog_status" = "200" ] || { echo "verify: каталог/база ответили $catalog_status"; return 1; }
  python3 - "$VERIFY_DIR/catalog.json" <<'PY' || return 1
import json, sys
try:
    with open(sys.argv[1], encoding="utf-8") as response:
        body = json.load(response)
    assert isinstance(body, dict) and isinstance(body.get("listings"), list)
    pagination = body.get("pagination")
    assert isinstance(pagination, dict)
    assert type(pagination.get("total")) is int and pagination["total"] >= 0
except (OSError, ValueError, AssertionError):
    print("verify: неверный JSON каталога/базы")
    sys.exit(1)
PY
  for path in /auctions /parts-finder /services/fuel-map; do
    curl -s "${CURL_OPTIONS[@]}" -o /dev/null "$BASE$path" || true
  done
  echo "verify: главная 200, CSS 200, каталог/база 200 с корректным JSON"
}

if check; then
  exit 0
fi

if [ "$CHECK_ONLY" = true ]; then
  echo "verify: диагностика не пройдена; --check-only не меняет сборку и сервис"
  exit 1
fi

if [ -d .next-prev ]; then
  echo "verify: откат на прежнюю сборку"
  rm -rf .next-failed
  mv .next .next-failed
  mv .next-prev .next
  systemctl restart automart
  sleep 8
  check || echo "verify: и прежняя сборка не отвечает — нужен ручной разбор"
fi
exit 1
