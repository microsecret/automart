/**
 * Подписки на появление топлива.
 *
 * Отметки наличия отвечают на вопрос «есть ли сейчас». Но человеку с
 * пустым баком нужно другое: узнать, когда появится. Иначе он открывает
 * карту двадцать раз за день или не открывает вовсе.
 *
 * Три вида подписки, и каждый отвечает своему случаю:
 *
 * • STATION — вся заправка: «сообщите, когда тут появится хоть что-то».
 *   Для того, кто стоит рядом и готов ждать.
 * • STATION_FUEL — марка на этой заправке: «когда тут будет 95».
 *   Для того, кому нужен именно 95 и именно здесь.
 * • CITY_FUEL — марка по городу: «когда 92 появится где угодно в Уфе».
 *   Самый частый случай в дефицит: человеку всё равно куда ехать.
 *
 * Модуль без импортов: правила должны проверяться тестами без базы.
 */

/** Виды подписки. */
export const SUBSCRIPTION_KINDS = ["STATION", "STATION_FUEL", "CITY_FUEL"] as const
export type SubscriptionKind = (typeof SUBSCRIPTION_KINDS)[number]

/**
 * Пауза между уведомлениями по одной подписке.
 *
 * Топливо появляется и заканчивается волнами: без паузы человек получил
 * бы пять сообщений за час о той же заправке и выключил бы бота. Час —
 * достаточный срок, чтобы доехать.
 */
export const NOTIFY_COOLDOWN_MS = 60 * 60 * 1000

/**
 * Сколько подписок разрешено одному человеку.
 *
 * Двадцать закрывают любой разумный случай: пять заправок по дороге на
 * работу плюс марки по городу. Больше — уже не подписка, а рассылка,
 * которая перестаёт читаться.
 */
export const MAX_SUBSCRIPTIONS_PER_USER = 20

/**
 * Через сколько молчаливая подписка засыпает.
 *
 * Человек подписался в дефицит, потом заправился и забыл. Через месяц
 * уведомление «на Свободы появился 92» для него шум, и он уходит из
 * бота целиком. Подписка не удаляется — помечается уснувшей, и человек
 * может разбудить её сам.
 */
export const IDLE_SLEEP_MS = 30 * 24 * 60 * 60 * 1000

export function isSubscriptionKind(value: unknown): value is SubscriptionKind {
  return typeof value === "string" && (SUBSCRIPTION_KINDS as readonly string[]).includes(value)
}

export type SubscriptionRow = {
  kind: string
  stationId: string | null
  fuel: string | null
  city: string | null
  lastNotifiedAt: Date | null
  createdAt: Date
}

export type AvailabilityChange = {
  stationId: string
  stationName: string
  city: string
  fuel: string
  fuelLabel: string
}

/**
 * Подходит ли подписка под появившееся топливо.
 *
 * Проверяется только совпадение, без учёта времени: паузу и сон
 * проверяет shouldNotify — так каждое правило остаётся отдельно
 * проверяемым.
 */
export function matchesChange(subscription: SubscriptionRow, change: AvailabilityChange): boolean {
  if (subscription.kind === "STATION") {
    return subscription.stationId === change.stationId
  }

  if (subscription.kind === "STATION_FUEL") {
    return subscription.stationId === change.stationId && subscription.fuel === change.fuel
  }

  if (subscription.kind === "CITY_FUEL") {
    /* Город сравнивается приведённым: в базе он приходит из справочника
       точек, а подписка заводится из выбранного человеком города, и
       регистр у них расходится. */
    return (
      subscription.fuel === change.fuel
      && typeof subscription.city === "string"
      && subscription.city.trim().toLowerCase() === change.city.trim().toLowerCase()
    )
  }

  return false
}

export type NotifyDecision = {
  send: boolean
  /** Почему не отправляем — для журнала, а не для человека. */
  reason?: "cooldown" | "asleep" | "no-match"
}

/**
 * Слать ли уведомление по этой подписке.
 *
 * Правила проверяются в порядке цены ошибки: сначала совпадение, потом
 * сон, потом пауза — чтобы уснувшая подписка не считалась «в паузе» и
 * не мешала понять журнал.
 */
export function shouldNotify(
  subscription: SubscriptionRow,
  change: AvailabilityChange,
  now: Date = new Date(),
): NotifyDecision {
  if (!matchesChange(subscription, change)) return { send: false, reason: "no-match" }

  /* Молчаливая подписка спит: отсчёт идёт от последнего уведомления, а
     если его не было — от создания. */
  const lastActivity = subscription.lastNotifiedAt ?? subscription.createdAt
  if (now.getTime() - lastActivity.getTime() > IDLE_SLEEP_MS) {
    return { send: false, reason: "asleep" }
  }

  if (
    subscription.lastNotifiedAt
    && now.getTime() - subscription.lastNotifiedAt.getTime() < NOTIFY_COOLDOWN_MS
  ) {
    return { send: false, reason: "cooldown" }
  }

  return { send: true }
}

/**
 * Текст уведомления.
 *
 * Название заправки первым: человек решает по нему, ехать ли, — а не по
 * марке топлива, которую он и так знает, раз подписывался.
 */
export function buildNotificationText(change: AvailabilityChange, kind: SubscriptionKind): string {
  const head = `⛽ <b>${escapeHtml(change.stationName)}</b>`
  const fuel = `Появился ${escapeHtml(change.fuelLabel)}`

  if (kind === "CITY_FUEL") {
    /* По городской подписке человек не знает эту заправку — город в
       строке помогает понять, далеко ли. */
    return `${head}\n${fuel} · ${escapeHtml(change.city)}\n\n<i>По отметкам водителей. Гарантий нет: пока едете, могут разобрать.</i>`
  }

  return `${head}\n${fuel}\n\n<i>По отметкам водителей. Гарантий нет: пока едете, могут разобрать.</i>`
}

/** Экранирование: название заправки приходит из справочника точек. */
function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}
