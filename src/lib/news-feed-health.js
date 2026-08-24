/**
 * Здоровье канала поставки новостей.
 *
 * Новости на площадку присылает внешний редактор — он стучится в
 * /api/news/import с личным токеном. 23 августа токен в настройках
 * заменили, и редактор сутки получал отказ 401. Никто этого не заметил:
 * лента просто перестала пополняться, а ошибка была видна только в
 * журнале nginx.
 *
 * Отсюда правило: молчание канала дольше суток — это поломка, о которой
 * нужно сказать вслух. Логика вынесена отдельно от скрипта, потому что
 * проверять «сколько часов тишины считать бедой» нужно без базы, сети и
 * запуска всего приложения.
 */

/** Сколько часов тишины — ещё норма. */
export const QUIET_HOURS_OK = 6

/** Сколько часов тишины — уже поломка. */
export const QUIET_HOURS_BROKEN = 24

/**
 * @typedef {"ok" | "quiet" | "broken" | "empty"} FeedState
 * @typedef {{ state: FeedState, hoursSilent: number | null, message: string }} FeedCheck
 */

/**
 * Оценка состояния канала.
 *
 * Три уровня вместо двух: «тихо» — это ещё не тревога. Редактор
 * присылает новости неравномерно, ночью пауза в шесть часов обычна, и
 * поднимать тревогу на каждой такой паузе значит приучить не смотреть на
 * предупреждения вовсе.
 */
export function checkNewsFeed(lastPublishedAt, now = new Date()) {
  const last = toDate(lastPublishedAt)

  if (!last) {
    return {
      state: "empty",
      hoursSilent: null,
      message: "В ленте нет ни одной новости — канал поставки не работал ни разу.",
    }
  }

  const hours = (now.getTime() - last.getTime()) / 3_600_000

  /* Отрицательное время бывает при расхождении часов сервера и базы.
     Это не поломка канала, и пугать таким сообщением не нужно. */
  if (hours < 0) {
    return { state: "ok", hoursSilent: 0, message: "Новости приходят." }
  }

  const rounded = Math.round(hours * 10) / 10

  if (hours >= QUIET_HOURS_BROKEN) {
    return {
      state: "broken",
      hoursSilent: rounded,
      message:
        `Новостей нет ${formatHours(rounded)}. Проверьте NEWS_IMPORT_TOKEN в .env: ` +
        "внешний редактор получает 401, если токен на площадке и у редактора разошёлся. " +
        "Отказы видны в журнале: grep 'news/import' /var/log/nginx/access.log",
    }
  }

  if (hours >= QUIET_HOURS_OK) {
    return {
      state: "quiet",
      hoursSilent: rounded,
      message: `Новостей нет ${formatHours(rounded)} — пока в пределах обычной паузы.`,
    }
  }

  return { state: "ok", hoursSilent: rounded, message: "Новости приходят." }
}

/** Нужно ли поднимать тревогу. */
export function isFeedBroken(check) {
  return check.state === "broken" || check.state === "empty"
}

/** «26,4 часа» — с русским склонением, а не «26.4 hours». */
function formatHours(hours) {
  const whole = Math.floor(hours)
  const text = Number.isInteger(hours) ? String(whole) : String(hours).replace(".", ",")

  const lastTwo = whole % 100
  const lastOne = whole % 10

  if (lastTwo >= 11 && lastTwo <= 14) return `${text} часов`
  if (lastOne === 1) return `${text} час`
  if (lastOne >= 2 && lastOne <= 4) return `${text} часа`
  return `${text} часов`
}

function toDate(value) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}
