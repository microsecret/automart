#!/usr/bin/env bash
# Проверка сайта после перезапуска и откат на прежнюю сборку при провале.
#
# `systemctl is-active` говорит только, что процесс жив. Сайт при этом может
# отдавать 500 или страницу со ссылками на несуществующие стили. Здесь
# проверяется то, что видит посетитель: главная отвечает 200, и первый стиль
# из её разметки действительно скачивается.
#
# Заодно это прогрев: первый запрос после перезапуска собирает страницу, и
# живой посетитель получает уже готовую.
set -uo pipefail
cd "$(dirname "$0")/.."

BASE="${AUTOMART_LOCAL_URL:-http://127.0.0.1:4001}"

check() {
  local html status css css_status
  for _ in 1 2 3 4 5 6; do
    status="$(curl -s -o /tmp/automart-verify.html -w '%{http_code}' "$BASE/")"
    [ "$status" = "200" ] && break
    sleep 5
  done
  [ "$status" = "200" ] || { echo "verify: главная ответила $status"; return 1; }
  css="$(grep -o '/_next/static/css/[a-zA-Z0-9]*\.css' /tmp/automart-verify.html | head -1)"
  [ -n "$css" ] || { echo "verify: в разметке главной нет стилей"; return 1; }
  css_status="$(curl -s -o /dev/null -w '%{http_code}' "$BASE$css")"
  [ "$css_status" = "200" ] || { echo "verify: стиль $css ответил $css_status"; return 1; }
  for path in /auctions /parts-finder /services/fuel-map; do
    curl -s -o /dev/null "$BASE$path" || true
  done
  echo "verify: главная 200, стили на месте ($css)"
}

if check; then
  exit 0
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
