#!/usr/bin/env bash
# Общая часть установки задач в расписание.
#
# Каждый скрипт установки читает текущий crontab, убирает свою строку и
# дописывает её заново. Пока чтение работает — всё верно. Но `crontab -l`
# при сбое возвращает пустоту, а конструкция `|| true` превращает сбой в
# обычный пустой результат: скрипт спокойно записывает единственную свою
# строку поверх пятидесяти четырёх задач.
#
# Именно так расписание уже дважды сокращалось до четырёх строк — по числу
# задач, которые ставит деплой. Пропали сборщик аукционов, уведомления,
# курсы валют.
#
# Здесь чтение отделено от записи: если прочитать не удалось или строк
# подозрительно мало, установка отменяется с ошибкой, а не молча стирает
# остальное.

# Меньше этого числа строк в рабочем расписании быть не может: только
# задач AutoMart шесть, а на сервере живут и другие проекты. Значение
# намеренно занижено — оно ловит обнуление, а не считает задачи.
CRON_MIN_LINES="${CRON_MIN_LINES:-6}"

# Читает текущее расписание в переменную CRON_CURRENT.
# Возвращает ненулевой код, если читать нечего или прочитанное неполно.
read_crontab() {
  local output status
  output="$(crontab -l 2>/dev/null)"
  status=$?

  # Код 1 при пустом выводе — законный случай «расписание пустое».
  # Любой другой код означает сбой, и записывать поверх нельзя.
  if (( status > 1 )); then
    echo "crontab -l завершился с кодом $status — расписание не тронуто" >&2
    return 1
  fi

  local lines
  lines="$(printf '%s\n' "$output" | grep -c '[^[:space:]]' || true)"

  # Пустое расписание допустимо только на новом сервере, где задач ещё нет.
  # Отличить его от сбоя нельзя, поэтому первую установку делают вручную:
  # переменная CRON_ALLOW_EMPTY снимает проверку осознанно.
  if (( lines == 0 )); then
    if [[ "${CRON_ALLOW_EMPTY:-}" == "1" ]]; then
      CRON_CURRENT=""
      return 0
    fi
    echo "Расписание пустое. Если сервер новый, запустите с CRON_ALLOW_EMPTY=1" >&2
    return 1
  fi

  if (( lines < CRON_MIN_LINES )); then
    echo "В расписании всего $lines строк — меньше ожидаемых $CRON_MIN_LINES." >&2
    echo "Похоже на потерю задач. Восстановите из /root/cron.full.* и повторите." >&2
    return 1
  fi

  CRON_CURRENT="$output"
  return 0
}

# Заменяет строку с указанной меткой на новую.
# Аргументы: метка (например «# automart-auction-rates»), строка задачи.
replace_cron_job() {
  local marker="$1" job="$2"

  read_crontab || return 1

  local filtered
  filtered="$(printf '%s\n' "$CRON_CURRENT" | grep -vF "$marker" || true)"

  local next
  next="$(printf '%s\n%s\n' "$filtered" "$job" | grep -v '^[[:space:]]*$')"

  # Последняя проверка перед записью: результат не должен быть короче
  # прочитанного больше чем на одну строку — свою собственную.
  local before after
  before="$(printf '%s\n' "$CRON_CURRENT" | grep -c '[^[:space:]]' || true)"
  after="$(printf '%s\n' "$next" | grep -c '[^[:space:]]' || true)"
  if (( after < before - 1 )); then
    echo "После замены осталось $after строк вместо $before — запись отменена" >&2
    return 1
  fi

  printf '%s\n' "$next" | crontab -
}

# Убирает строку с указанной меткой, ничего не добавляя.
# Нужна там, где задачу отключают: снятие задачи так же опасно, как
# установка, — при сбое чтения расписание стёрлось бы целиком.
remove_cron_job() {
  local marker="$1"

  read_crontab || return 1

  # Нечего убирать — расписание не трогаем вовсе.
  if ! printf '%s\n' "$CRON_CURRENT" | grep -qF "$marker"; then
    return 0
  fi

  local next
  next="$(printf '%s\n' "$CRON_CURRENT" | grep -vF "$marker" | grep -v '^[[:space:]]*$')"

  local before after
  before="$(printf '%s\n' "$CRON_CURRENT" | grep -c '[^[:space:]]' || true)"
  after="$(printf '%s\n' "$next" | grep -c '[^[:space:]]' || true)"
  # Убрать можно только строки с этой меткой — обычно одну.
  if (( before - after > 2 )); then
    echo "Снятие задачи убрало бы $((before - after)) строк — запись отменена" >&2
    return 1
  fi

  printf '%s\n' "$next" | crontab -
}
