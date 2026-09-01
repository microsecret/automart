#!/usr/bin/env bash
set -uo pipefail

# Держит api.telegram.org на живом адресе.
#
# Провайдер блокирует часть адресов Telegram, и какой именно попадёт под
# нож — меняется. DNS при этом честно отдаёт заблокированный: обращения
# просто истекают по времени, бот молчит в чатах и не модерирует, а в
# журнале — только «timed out» без объяснения.
#
# Сторож проверяет текущий адрес и, если тот не отвечает, перебирает
# известные серверы Telegram и закрепляет рабочий в /etc/hosts. Ничего не
# меняется, пока связь есть: запись в hosts появляется только при
# необходимости и снимается, когда обычный DNS снова годится.
#
# Адреса взяты из подсети Telegram (149.154.160.0/20 и 91.108.4.0/22) —
# это разные дата-центры, и блокируют их не разом.

HOSTS_FILE=/etc/hosts
DOMAIN=api.telegram.org
CANDIDATES=(
  149.154.167.220
  149.154.167.51
  149.154.175.50
  149.154.171.5
  91.108.56.130
  91.108.4.130
)

log() { echo "[telegram-endpoint] $*"; }

# Отвечает ли домен прямо сейчас. Проверяем сам API, а не просто порт:
# открытый порт бывает и у молчащего узла.
probe() {
  local ip="$1"
  curl -4 -s --max-time 8 --resolve "${DOMAIN}:443:${ip}" \
    -o /dev/null -w '%{http_code}' "https://${DOMAIN}/" 2>/dev/null
}

current_pin() {
  grep -E "^[0-9.]+[[:space:]]+${DOMAIN}\$" "$HOSTS_FILE" 2>/dev/null | awk '{print $1}' | head -1
}

set_pin() {
  local ip="$1"
  local tmp
  tmp="$(mktemp)"
  grep -v "[[:space:]]${DOMAIN}\$" "$HOSTS_FILE" > "$tmp"
  [ -n "$ip" ] && echo "${ip} ${DOMAIN}" >> "$tmp"
  cp "$tmp" "$HOSTS_FILE"
  rm -f "$tmp"
}

# 1. Без закрепления DNS может работать сам — тогда ничего не трогаем.
pinned="$(current_pin)"
if [ -z "$pinned" ]; then
  code="$(curl -4 -s --max-time 8 -o /dev/null -w '%{http_code}' "https://${DOMAIN}/" 2>/dev/null)"
  if [ "$code" != "000" ] && [ -n "$code" ]; then
    exit 0
  fi
fi

# 2. Закреплённый адрес ещё жив — тоже ничего не делаем.
if [ -n "$pinned" ]; then
  code="$(probe "$pinned")"
  if [ "$code" != "000" ] && [ -n "$code" ]; then
    exit 0
  fi
  log "закреплённый ${pinned} перестал отвечать, ищу замену"
fi

# 3. Ищем рабочий адрес.
for ip in "${CANDIDATES[@]}"; do
  code="$(probe "$ip")"
  if [ "$code" != "000" ] && [ -n "$code" ]; then
    set_pin "$ip"
    log "закрепил ${ip} (ответ ${code})"
    # Бот держит соединения открытыми и сам о смене адреса не узнает.
    systemctl restart automart-telegram 2>/dev/null || true
    exit 0
  fi
done

# 4. Не отвечает ни один: закрепление снимаем, чтобы не мешать DNS, когда
#    блокировка спадёт. Молчать здесь нельзя — это как раз тот случай,
#    ради которого сторож и написан.
log "ни один адрес Telegram не отвечает — снимаю закрепление"
set_pin ""
exit 1
