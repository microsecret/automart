#!/usr/bin/env bash
# Сборка в отдельную папку и мгновенная подмена.
#
# Раньше `next build` писал прямо в .next, из которой в это же время
# отдавал страницы работающий сервер. Сборка стирала его чанки, и все
# 6–10 минут сборки посетители получали «Application error»: страница
# просила скрипты и стили, которых на диске уже не было (замер 24.09.2026 —
# /dashboard и /parts-finder падали целиком, пока шла сборка).
#
# Теперь сборка идёт в .next-build, старая .next не тронута до самого
# конца. После удачной сборки папки меняются местами двумя переименованиями —
# окно рассогласования сжимается до секунд перед перезапуском службы.
# Провальная сборка не трогает .next вовсе: сайт работает на прежней.
#
# Прежняя сборка остаётся в .next-prev — откат одной командой
# (см. scripts/verify-or-rollback.sh).
set -euo pipefail
cd "$(dirname "$0")/.."

BUILD_DIR=.next-build
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR/cache"

# Кэш компилятора переезжает в новую папку: без него сборка идёт с нуля и
# вдвое дольше. Работающему серверу он не нужен — это кэш сборки, а не
# страниц.
for dir in webpack swc; do
  if [ -d ".next/cache/$dir" ]; then mv ".next/cache/$dir" "$BUILD_DIR/cache/"; fi
done

restore_compiler_cache() {
  for dir in webpack swc; do
    if [ -d "$BUILD_DIR/cache/$dir" ] && [ -d .next/cache ] && [ ! -e ".next/cache/$dir" ]; then
      mv "$BUILD_DIR/cache/$dir" ".next/cache/"
    fi
  done
}

if ! NEXT_DIST_DIR="$BUILD_DIR" NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=3500}" npx next build; then
  restore_compiler_cache
  echo "build-atomic: сборка упала — .next не тронута, сайт работает на прежней сборке" >&2
  exit 1
fi

if [ ! -f "$BUILD_DIR/BUILD_ID" ]; then
  restore_compiler_cache
  echo "build-atomic: в $BUILD_DIR нет BUILD_ID — подмена отменена" >&2
  exit 1
fi

# Кэши, которые наполняет работающий сайт (картинки, фото лотов), переходят
# в новую сборку, чтобы после перезапуска не пережимать всё заново.
if [ -d .next/cache ]; then
  for entry in .next/cache/*; do
    [ -e "$entry" ] || continue
    name="$(basename "$entry")"
    [ -e "$BUILD_DIR/cache/$name" ] || mv "$entry" "$BUILD_DIR/cache/"
  done
fi

rm -rf .next-prev
if [ -d .next ]; then mv .next .next-prev; fi
mv "$BUILD_DIR" .next
echo "build-atomic: подменено на сборку $(cat .next/BUILD_ID)"
