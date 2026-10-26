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
# признаков: журнал стоит дольше порога, в логе службы копятся P1008, не идёт
# ни деплой, ни ночная копия базы, ни миграция, и с прошлого перезапуска
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
MIN_TIMEOUTS="${AUTOMART_DB_MIN_TIMEOUTS:-5}"
COOLDOWN_SECONDS="${AUTOMART_DB_WATCHDOG_COOLDOWN:-1800}"
STATE_FILE="${AUTOMART_DB_WATCHDOG_STATE:-/var/tmp/automart-db-watchdog.last}"
INCIDENT_DIR="${AUTOMART_DB_INCIDENT_DIR:-/root/db-lock-incidents}"
DRY_RUN="${AUTOMART_DB_WATCHDOG_DRY_RUN:-0}"

log() { echo "[$(date -u +%FT%TZ)] $*"; }

# Журнала нет — записи не идёт, всё в порядке. Самый частый исход: молча.
[ -f "$JOURNAL" ] || exit 0

now=$(date +%s)
age=$(( now - $(stat -c %Y "$JOURNAL") ))
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

# Стоящий журнал без жалоб службы — долгая, но живая запись: ждём.
timeouts=$(journalctl -u "$SERVICE" --since "-5min" --no-pager 2>/dev/null | grep -c "P1008")
if [ "$timeouts" -lt "$MIN_TIMEOUTS" ]; then
  log "журнал стоит ${age} с, таймаутов P1008 за 5 минут: ${timeouts} — жду"; exit 0
fi

# Не перезапускать по кругу: если причина вернулась сразу, нужен человек.
if [ -f "$STATE_FILE" ]; then
  last=$(cat "$STATE_FILE" 2>/dev/null || echo 0)
  if [ $(( now - last )) -lt "$COOLDOWN_SECONDS" ]; then
    log "база снова встала через $(( now - last )) с после перезапуска — повторно не перезапускаю, нужен человек"; exit 1
  fi
fi

if [ "$DRY_RUN" = "1" ]; then
  log "ПРОБНЫЙ ЗАПУСК: журнал стоит ${age} с, P1008 за 5 минут: ${timeouts} — перезапустил бы ${SERVICE}"; exit 0
fi

# Улики для поиска причины.
incident="$INCIDENT_DIR/$(date -u +%Y%m%d-%H%M%S)"
mkdir -p "$incident"
cp -p "$JOURNAL" "$incident/" 2>/dev/null
fuser -v "$DB" "$JOURNAL" > "$incident/holders.txt" 2>&1
inode=$(stat -c %i "$DB")
grep ":${inode} " /proc/locks > "$incident/locks.txt" 2>/dev/null
journalctl -u "$SERVICE" --since "-40min" --no-pager 2>/dev/null | grep -vE ' (GET|HEAD) ' | tail -600 > "$incident/journal.txt"
ps -eo pid,etime,pcpu,rss,args --sort=-etime > "$incident/ps.txt"
crontab -l > "$incident/crontab.txt" 2>/dev/null

echo "$now" > "$STATE_FILE"
log "база стоит: журнал ${age} с, P1008 за 5 минут: ${timeouts}. Улики: ${incident}. Перезапускаю ${SERVICE}"
systemctl restart "$SERVICE"

code=000
for _ in $(seq 1 20); do
  code=$(curl -s -o /dev/null -w '%{http_code}' -m 15 http://127.0.0.1:4001/ || echo 000)
  [ "$code" = 200 ] && break
  sleep 3
done
log "после перезапуска главная отвечает ${code}"

# Оповещение в чат модерации: тот же бот и те же адресаты, что у остальных
# служебных сообщений.
env_value() { grep -E "^$1=" "$APP_DIR/.env" 2>/dev/null | tail -1 | cut -d= -f2- | sed -E 's/^"(.*)"$/\1/'; }
token="$(env_value TELEGRAM_BOT_TOKEN)"
chats="$(env_value TELEGRAM_MODERATION_CHAT_IDS)"
if [ -n "$token" ] && [ -n "$chats" ]; then
  text="⚠️ LeWheel: база зависла (журнал не менялся ${age} с, ${timeouts} таймаутов за 5 минут). Сайт перезапущен автоматически, главная отвечает ${code}. Улики на сервере: ${incident}"
  for chat in ${chats//,/ }; do
    curl -s -m 15 -o /dev/null "https://api.telegram.org/bot${token}/sendMessage" \
      --data-urlencode "chat_id=${chat}" --data-urlencode "text=${text}" || log "оповещение в ${chat} не ушло"
  done
fi
