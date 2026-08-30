/**
 * Когда спросить водителя об отметке.
 *
 * Карта живёт отметками, а отмечают редко: человек за рулём не станет
 * открывать сайт и заполнять форму — ему некогда, он заправился и уехал.
 * Но если он один раз включил в боте трансляцию геопозиции, площадка
 * сама видит, что он остановился у АЗС, и может спросить в тот
 * единственный момент, когда ответ ничего не стоит: он стоит у колонки и
 * только что видел табло с ценами.
 *
 * Правила здесь — про уместность, а не про технику. Спросить не вовремя
 * хуже, чем не спросить: человек отключит трансляцию и больше её не
 * включит.
 */

/** Ближе этого считаем, что человек на территории заправки. */
export const PRESENCE_RADIUS_KM = 0.12

/**
 * Сколько нужно простоять, чтобы вопрос был уместен.
 *
 * Заправка занимает пять-семь минут вместе с очередью. Пятнадцать —
 * значит, точно заправлялся, а не проехал мимо на светофоре. Владелец
 * предлагал пятьдесят: столько стоят разве что в кафе при АЗС, и к тому
 * времени человек уже уедет.
 */
export const PRESENCE_MINUTES = 15

/**
 * Через сколько запись считается протухшей.
 *
 * Трансляция обновляется раз в минуту-две. Если обновлений нет полчаса —
 * человек её выключил или уехал вне зоны, и старая точка врёт.
 */
export const PRESENCE_STALE_MINUTES = 30

/** Одну и ту же заправку не спрашиваем дважды за сутки. */
export const PRESENCE_COOLDOWN_HOURS = 20

export type PresenceRecord = {
  stationId: string
  arrivedAt: Date
  seenAt: Date
  promptedAt: Date | null
}

export type PresenceDecision =
  | { action: "ask" }
  | { action: "wait"; minutesLeft: number }
  | { action: "skip"; reason: "already-asked" | "stale" | "too-short" }

/**
 * Пора ли спрашивать.
 *
 * Возвращает решение, а не пишет в базу и не шлёт сообщений: так правило
 * читается целиком в одном месте и проверяется без Telegram.
 */
export function decidePresencePrompt(record: PresenceRecord, now: Date = new Date()): PresenceDecision {
  const sinceSeen = (now.getTime() - record.seenAt.getTime()) / 60_000
  if (sinceSeen > PRESENCE_STALE_MINUTES) return { action: "skip", reason: "stale" }

  if (record.promptedAt) {
    const sincePrompt = (now.getTime() - record.promptedAt.getTime()) / 3_600_000
    /* Второй раз о той же заправке — навязчивость: человек уже решил,
       отвечать ему или нет. */
    if (sincePrompt < PRESENCE_COOLDOWN_HOURS) return { action: "skip", reason: "already-asked" }
  }

  const standing = (now.getTime() - record.arrivedAt.getTime()) / 60_000
  if (standing < PRESENCE_MINUTES) {
    return { action: "wait", minutesLeft: Math.max(1, Math.ceil(PRESENCE_MINUTES - standing)) }
  }

  return { action: "ask" }
}

/**
 * Остался ли человек на той же заправке.
 *
 * Смена точки обнуляет отсчёт: доехал до соседней АЗС — значит, на
 * прежней не стоял, и спрашивать о ней уже поздно.
 */
export function isSameStop(previousStationId: string | null, nextStationId: string) {
  return previousStationId === nextStationId
}

/**
 * Текст приглашения.
 *
 * Пишем как человеку, который занят: одно предложение о том, что от него
 * нужно, и почему это стоит его тридцати секунд. Без «уважаемый
 * пользователь» и без объяснения, как устроена площадка.
 */
export function presencePromptText(stationName: string) {
  return [
    `⛽ <b>Вы на «${stationName}»?</b>`,
    "",
    "Скажите, какое топливо там есть и почём — это тридцать секунд, а другим водителям сэкономит поездку впустую.",
    "",
    "Вы сейчас видите табло, а они — нет.",
  ].join("\n")
}
