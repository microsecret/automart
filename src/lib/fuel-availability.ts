/**
 * Наличие топлива на АЗС по отметкам водителей.
 *
 * Цена на карте была, а наличия не было — и в дефицит именно оно решает,
 * ехать ли на заправку. Цену человек и так примерно знает; чего он не
 * знает, так это привезли ли сегодня 92-й и какая там очередь.
 *
 * Правила отличаются от ценовых, и сильно:
 *
 * • Наличие живёт часами, а не неделю. Отметка «есть 95» трёхдневной
 *   давности не значит ничего: бензин разбирают за день. Поэтому окно
 *   свежести короткое, а возраст отметки показывается всегда — «20 минут
 *   назад» само по себе половина ответа.
 *
 * • «Нет» весит больше, чем «есть». Человек, приехавший к пустой колонке,
 *   отмечает это охотнее, чем тот, кто спокойно заправился, — и ошибка
 *   здесь дешевле: съездить зря хуже, чем не поехать на всякий случай.
 *   Поэтому при равном числе свежих отметок побеждает «нет».
 *
 * Модуль без импортов: он должен проверяться тестами без базы.
 */

/** Виды топлива те же, что у ценовых отметок: списки не должны расходиться. */
export const AVAILABILITY_FUELS = ["AI92", "AI95", "AI98", "AI100", "DT", "GAS"] as const
export type AvailabilityFuel = (typeof AVAILABILITY_FUELS)[number]

export const AVAILABILITY_FUEL_LABELS: Readonly<Record<AvailabilityFuel, string>> = {
  AI92: "92",
  AI95: "95",
  AI98: "98",
  AI100: "100",
  DT: "ДТ",
  GAS: "Газ",
}

/** Что отмечает человек. */
export const AVAILABILITY_STATES = ["YES", "NO"] as const
export type AvailabilityState = (typeof AVAILABILITY_STATES)[number]

/** Очередь: необязательное уточнение к «есть». */
export const QUEUE_LEVELS = ["NONE", "SMALL", "BIG"] as const
export type QueueLevel = (typeof QUEUE_LEVELS)[number]

export const QUEUE_LABELS: Readonly<Record<QueueLevel, string>> = {
  NONE: "без очереди",
  SMALL: "небольшая очередь",
  BIG: "большая очередь",
}

/**
 * Сколько отметка считается свежей.
 *
 * Шесть часов — половина рабочего дня заправки. За это время подвоз либо
 * был, либо нет; более старая отметка вводит в заблуждение сильнее, чем
 * её отсутствие.
 */
export const FRESH_WINDOW_MS = 6 * 60 * 60 * 1000

/**
 * Через сколько отметка перестаёт показываться вовсе.
 *
 * Сутки: вчерашнее «есть 92» не помогает, но вчерашнее «нет» ещё
 * говорит, что на этой заправке были перебои.
 */
export const STALE_WINDOW_MS = 24 * 60 * 60 * 1000

export function isAvailabilityFuel(value: unknown): value is AvailabilityFuel {
  return typeof value === "string" && (AVAILABILITY_FUELS as readonly string[]).includes(value)
}

export function isAvailabilityState(value: unknown): value is AvailabilityState {
  return typeof value === "string" && (AVAILABILITY_STATES as readonly string[]).includes(value)
}

export function isQueueLevel(value: unknown): value is QueueLevel {
  return typeof value === "string" && (QUEUE_LEVELS as readonly string[]).includes(value)
}

export type AvailabilityReportRow = {
  fuel: string
  state: string
  queue?: string | null
  /** Снимок колонки — доказательство к отметке. */
  photo?: string | null
  /** Короткая подпись к снимку. */
  comment?: string | null
  createdAt: Date
}

export type FuelAvailability = {
  fuel: AvailabilityFuel
  label: string
  /** Что показывать: есть, нет или сведений не осталось. */
  state: AvailabilityState | "UNKNOWN"
  /** Сколько человек отметили то же самое за окно свежести. */
  confirmations: number
  /** Когда отметили в последний раз. */
  updatedAt: Date | null
  /** Очередь по свежим отметкам «есть»; null — не сообщали. */
  queue: QueueLevel | null
  /** Снимок из самой свежей отметки, если он был. */
  photo: string | null
  /** Подпись из самой свежей отметки, если она была. */
  comment: string | null
}

/**
 * Сводит отметки в состояние по каждому виду топлива.
 *
 * Возвращает по строке на каждый вид, о котором вообще были отметки:
 * молчание о 98-м не значит, что его нет, — значит, никто не смотрел.
 */
export function summarizeAvailability(
  rows: readonly AvailabilityReportRow[],
  now: Date = new Date(),
): FuelAvailability[] {
  const byFuel = new Map<AvailabilityFuel, AvailabilityReportRow[]>()

  for (const row of rows) {
    if (!isAvailabilityFuel(row.fuel) || !isAvailabilityState(row.state)) continue
    if (now.getTime() - row.createdAt.getTime() > STALE_WINDOW_MS) continue
    const list = byFuel.get(row.fuel) ?? []
    list.push(row)
    byFuel.set(row.fuel, list)
  }

  const result: FuelAvailability[] = []

  for (const fuel of AVAILABILITY_FUELS) {
    const list = byFuel.get(fuel)
    if (!list || list.length === 0) continue

    const fresh = list.filter((row) => now.getTime() - row.createdAt.getTime() <= FRESH_WINDOW_MS)
    /* Свежих нет — берём всё, что осталось в сутках: старое «нет» лучше
       полного молчания, но состояние честно помечается по возрасту. */
    const source = fresh.length > 0 ? fresh : list

    const yes = source.filter((row) => row.state === "YES")
    const no = source.filter((row) => row.state === "NO")

    /* При равенстве побеждает «нет»: съездить зря хуже, чем не поехать. */
    const state: AvailabilityState = no.length >= yes.length && no.length > 0 ? "NO" : "YES"
    const winning = state === "NO" ? no : yes

    const updatedAt = winning.reduce<Date | null>(
      (latest, row) => (latest === null || row.createdAt > latest ? row.createdAt : latest),
      null,
    )

    /* Снимок берётся из самой свежей отметки победившего состояния:
       фотография часовой давности говорит о заправке больше, чем
       вчерашняя, даже если вчерашняя чётче. */
    const newest = winning.reduce<AvailabilityReportRow | null>(
      (latest, row) => (latest === null || row.createdAt > latest.createdAt ? row : latest),
      null,
    )

    result.push({
      fuel,
      label: AVAILABILITY_FUEL_LABELS[fuel],
      state,
      confirmations: winning.length,
      updatedAt,
      queue: state === "YES" ? pickQueue(yes) : null,
      photo: typeof newest?.photo === "string" ? newest.photo : null,
      comment: typeof newest?.comment === "string" ? newest.comment : null,
    })
  }

  return result
}

/**
 * Какая очередь по отметкам «есть».
 *
 * Берётся худшая из свежих: человек, попавший в хвост, сообщает об этом,
 * а тот, кто заправился сразу, чаще молчит. Занизить очередь хуже, чем
 * завысить: во втором случае человек просто приедет готовым ждать.
 */
function pickQueue(rows: readonly AvailabilityReportRow[]): QueueLevel | null {
  let worst: QueueLevel | null = null
  const order: Record<QueueLevel, number> = { NONE: 0, SMALL: 1, BIG: 2 }

  for (const row of rows) {
    if (!isQueueLevel(row.queue)) continue
    if (worst === null || order[row.queue] > order[worst]) worst = row.queue
  }

  return worst
}

/**
 * Возраст отметки словами.
 *
 * «20 минут назад» — половина ответа: по свежести человек сам решает,
 * верить ли. Часы округляются вниз, чтобы не обещать большей точности,
 * чем есть.
 */
export function formatAge(updatedAt: Date | null, now: Date = new Date()): string | null {
  if (!updatedAt) return null

  const minutes = Math.floor((now.getTime() - updatedAt.getTime()) / 60_000)
  if (minutes < 1) return "только что"
  if (minutes < 60) return `${minutes} мин назад`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} ч назад`

  const days = Math.floor(hours / 24)
  return days === 1 ? "вчера" : `${days} дн назад`
}

/**
 * Свежая ли отметка настолько, чтобы на неё полагаться.
 *
 * По этому признаку карта решает, красить точку ярко или приглушённо:
 * шестичасовое «есть» — сведение, вчерашнее — воспоминание.
 */
export function isFresh(updatedAt: Date | null, now: Date = new Date()): boolean {
  if (!updatedAt) return false
  return now.getTime() - updatedAt.getTime() <= FRESH_WINDOW_MS
}
