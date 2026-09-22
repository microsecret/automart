#!/bin/bash
# Деплой Авторынка: пауза cron -> git pull -> сборка -> перезапуск -> возврат cron.
set -x
exec > /tmp/deploy.log 2>&1

pkill -f chromium_headless_shell

# Пауза cron.
#
# Раньше здесь было `crontab -l > /tmp/cron.bak` без проверки. Когда crontab
# уже оказывался снят (предыдущий деплой не вернул его, оборвавшись), в файл
# писалась пустота, а строка возврата ставила пустое расписание. Так проект
# на трое суток остался без всех двенадцати заданий: цены АЗС, аукционные
# лоты и курсы валют перестали обновляться, и это не было видно ни по логам,
# ни по коду — сайт отвечал 200 на все страницы.
#
# Теперь: копия с меткой времени, снятие только если в копии есть задания.
CRON_SNAPSHOT="/root/cron-snapshots/crontab-$(date +%Y%m%d-%H%M%S).txt"
mkdir -p /root/cron-snapshots
CRON_PAUSED=0
if crontab -l > "$CRON_SNAPSHOT" 2>/dev/null && [ -s "$CRON_SNAPSHOT" ]; then
  crontab -r 2>/dev/null
  CRON_PAUSED=1
  echo "cron снят, копия: $CRON_SNAPSHOT ($(grep -cvE "^#|^$" "$CRON_SNAPSHOT") заданий)"
else
  rm -f "$CRON_SNAPSHOT"
  echo "ВНИМАНИЕ: crontab пуст или не читается — пауза пропущена, снимать нечего"
fi

# Возврат расписания при любом выходе, включая обрыв по Ctrl+C или ошибке.
restore_cron() {
  [ "$CRON_PAUSED" = "1" ] || return 0
  if crontab "$CRON_SNAPSHOT" 2>/dev/null; then
    echo "cron возвращён: $(crontab -l | grep -cvE "^#|^$") заданий"
  else
    echo "ОШИБКА: cron не вернулся, восстановить вручную: crontab $CRON_SNAPSHOT"
  fi
}
trap restore_cron EXIT

cd /root/AutoMart
# Ветка master, а не main: main — пустой Initial commit, весь проект в master.
# Из-за git pull origin main пять коммитов подряд не доезжали до сайта,
# а pull бодро отвечал "Already up to date".
git pull origin master
git log --oneline -1
free -m | head -2

NODE_OPTIONS='--max-old-space-size=3500' npx next build
BUILD=$?

# Служба перезапускается только на удачной сборке.
#
# Раньше перезапуск шёл всегда. На провальной сборке .next оставалась
# недописанной, и служба поднималась в пустоту: сайт отдавал 502, а в журнале
# росла стена "Could not find a production build" — 1029 строк за сутки.
# Старая сборка при этом продолжала бы работать, если её не трогать.
if [ "$BUILD" -eq 0 ]; then
  systemctl restart automart.service
  sleep 8
  curl -s -o /dev/null -w "site:%{http_code}\n" http://127.0.0.1:4001/
else
  echo "СБОРКА УПАЛА (код $BUILD) — служба не тронута, сайт работает на прежней сборке"
  curl -s -o /dev/null -w "site:%{http_code}\n" http://127.0.0.1:4001/
fi

echo "DONE build=$BUILD"
