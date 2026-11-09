#!/usr/bin/env bash
# Сторож зависшей блокировки базы.
#
# 21 октября 2026 сайт 43 минуты отвечал «Неверный email или пароль» всем
# подряд, а главная, бот и заправки падали с P1008 «Operations timed out».
# Процесс сайта держал незавершённую запись: файл dev.db-journal не менялся
# 26 минут, процессор стоял на нуле, cron ничего не запускал. SQLite в
# журнальном режиме ставит новые чтения в очередь за такой записью, и база
# замирает для всех. Лечится перезапуском службы — журнал откатывается
# штатно, данные целы. Но человека, который заметит, может не оказаться.
#
# Сторож делает то же, что сделал бы дежурный, и только при совпадении всех
# признаков: журнал стоит дольше порога, процесс сайта держит блокировку
# записи и независимое чтение дважды возвращает SQLITE_BUSY/SQLITE_LOCKED.
# Не идёт деплой, ночная копия базы или миграция, и с прошлого перезапуска
# прошло достаточно времени. Перед перезапуском сохраняются улики — кто
# держит файл, блокировки ядра, хвост лога: причина зависания пока не
# найдена, и следующий случай должен её показать.
#
# Запуск из cron раз в две минуты (scripts/install-db-watchdog-cron.sh).
# AUTOMART_DB_WATCHDOG_DRY_RUN=1 — только сказать, что было бы сделано.

set -uo pipefail

APP_DIR="${AUTOMART_APP_DIR:-/root/AutoMart}"
DB="${AUTOMART_DB_PATH:-$APP_DIR/prisma/dev.db}"
JOURNAL="$DB-journal"
SERVICE="${AUTOMART_SERVICE:-automart.service}"
STUCK_SECONDS="${AUTOMART_DB_STUCK_SECONDS:-300}"
COOLDOWN_SECONDS="${AUTOMART_DB_WATCHDOG_COOLDOWN:-1800}"
STATE_FILE="${AUTOMART_DB_WATCHDOG_STATE:-/var/tmp/automart-db-watchdog.last}"
INCIDENT_DIR="${AUTOMART_DB_INCIDENT_DIR:-/root/db-lock-incidents}"
DRY_RUN="${AUTOMART_DB_WATCHDOG_DRY_RUN:-0}"

log() { echo "[$(date -u +%FT%TZ)] $*"; }

# Журнала нет — записи не идёт, всё в порядке. Самый частый исход: молча.
[ -f "$JOURNAL" ] || exit 0

now=$(date +%s)
journal_mtime=$(stat -c %Y "$JOURNAL" 2>/dev/null) || exit 0
age=$(( now - journal_mtime ))
[ "$age" -ge "$STUCK_SECONDS" ] || exit 0

# Законно долгие операции.
if [ -e /tmp/automart-deploy-pending ] || pgrep -f "deploy-production.sh" >/dev/null; then
  log "журнал стоит ${age} с, но идёт деплой — не трогаю"; exit 0
fi
if pgrep -f "scripts/backup-db.mjs" >/dev/null; then
  log "журнал стоит ${age} с, но идёт копия базы — не трогаю"; exit 0
fi
if pgrep -f "prisma migrate" >/dev/null; then
  log "журнал стоит ${age} с, но идёт миграция — не трогаю"; exit 0
fi

# Prisma can report SQL error 1 after a failed commit. A stale journal alone
# is normal. Confirm that this exact process owns a blocking write lock and
# that another connection cannot read the file.
pid=$(systemctl show -p MainPID --value "$SERVICE") || exit 0
[[ "$pid" =~ ^[1-9][0-9]*$ ]] || exit 0
timeout 8s python3 - "$DB" "$pid" <<'PY' || exit 0
import os
import sqlite3
import sys
from pathlib import Path

db = Path(sys.argv[1]).resolve(strict=True)
pid = sys.argv[2]
st = db.stat()
identity = (os.major(st.st_dev), os.minor(st.st_dev), st.st_ino)

def owned_write_lock():
    for line in Path('/proc/locks').read_text().splitlines():
        fields = line.split()
        if len(fields) < 8 or fields[1:5] != ['POSIX', 'ADVISORY', 'WRITE', pid]:
            continue
        major, minor, inode = fields[5].split(':')
        if (int(major, 16), int(minor, 16), int(inode)) == identity:
            return True
    return False

for _ in range(2):
    if not owned_write_lock():
        sys.exit(1)
    try:
        with sqlite3.connect(db.as_uri() + '?mode=ro', uri=True, timeout=2) as conn:
            conn.execute('SELECT name FROM sqlite_master LIMIT 1').fetchone()
        sys.exit(1)
    except sqlite3.OperationalError as error:
        if (error.sqlite_errorcode & 255) not in (sqlite3.SQLITE_BUSY, sqlite3.SQLITE_LOCKED):
            sys.exit(1)
sys.exit(0 if owned_write_lock() else 1)
PY

# A successful write or a concurrent restart invalidates the diagnosis.
[ "$(stat -c %Y "$JOURNAL" 2>/dev/null)" = "$journal_mtime" ] || exit 0
[ "$(systemctl show -p MainPID --value "$SERVICE")" = "$pid" ] || exit 0
[ ! -e /tmp/automart-deploy-pending ] || exit 0

# Не перезапускать по кругу: если причина вернулась сразу, нужен человек.
if [ -f "$STATE_FILE" ]; then
  last=$(cat "$STATE_FILE" 2>/dev/null || echo 0)
  if [ $(( now - last )) -lt "$COOLDOWN_SECONDS" ]; then
    log "база снова встала через $(( now - last )) с после перезапуска — повторно не перезапускаю, нужен человек"; exit 1
  fi
fi

if [ "$DRY_RUN" = "1" ]; then
  log "ПРОБНЫЙ ЗАПУСК: журнал стоит ${age} с, процесс ${pid} блокирует чтение SQLite — перезапустил бы ${SERVICE}"; exit 0
fi

# Улики для поиска причины.
incident="$INCIDENT_DIR/$(date -u +%Y%m%d-%H%M%S)"
umask 077
mkdir -p "$incident"
cp -p "$JOURNAL" "$incident/" 2>/dev/null
fuser -v "$DB" "$JOURNAL" > "$incident/holders.txt" 2>&1
inode=$(stat -c %i "$DB")
grep ":${inode} " /proc/locks > "$incident/locks.txt" 2>/dev/null
journalctl -u "$SERVICE" --since "-40min" --no-pager 2>/dev/null | grep -vE ' (GET|HEAD) ' | tail -600 > "$incident/journal.txt"
ps -eo pid,etime,pcpu,rss,comm --sort=-etime > "$incident/ps.txt"

echo "$now" > "$STATE_FILE"
log "база стоит: журнал ${age} с, процесс ${pid} блокирует чтение SQLite. Улики: ${incident}. Перезапускаю ${SERVICE}"
systemctl restart "$SERVICE" || exit 1

code=000
for _ in $(seq 1 20); do
  code=$(curl -s -o /dev/null -w '%{http_code}' -m 5 'http://127.0.0.1:4001/api/listings?limit=1' || echo 000)
  [ "$code" = 200 ] && break
  sleep 3
done
log "после перезапуска каталог отвечает ${code}"

# Оповещение в чат модерации: тот же бот и те же адресаты, что у остальных
# служебных сообщений.
env_value() { grep -E "^$1=" "$APP_DIR/.env" 2>/dev/null | tail -1 | cut -d= -f2- | sed -E 's/^"(.*)"$/\1/'; }
token="$(env_value TELEGRAM_BOT_TOKEN)"
chats="$(env_value TELEGRAM_MODERATION_CHAT_IDS)"
if [ -n "$token" ] && [ -n "$chats" ]; then
  text="⚠️ LeWheel: база зависла (журнал не менялся ${age} с, независимое чтение заблокировано). Сайт перезапущен автоматически, каталог отвечает ${code}. Улики на сервере: ${incident}"
  for chat in ${chats//,/ }; do
    curl -s -m 15 -o /dev/null "https://api.telegram.org/bot${token}/sendMessage" \
      --data-urlencode "chat_id=${chat}" --data-urlencode "text=${text}" || log "оповещение в ${chat} не ушло"
  done
fi
