/**
 * Отметка наличия топлива из бота, по геолокации.
 *
 * Карта отвечает на вопрос «где есть бензин», но отметить наличие на ней
 * может только тот, кто её открыл. Человек за рулём этого не делает: он
 * стоит в очереди, у него телефон в руке и минута времени.
 *
 * В боте всё иначе — он уже открыт, чтобы посмотреть чат. Человек шлёт
 * точку одним нажатием скрепки, бот сам находит ближайшую заправку и
 * спрашивает кнопками. Отметка занимает два нажатия вместо открытия
 * сайта, выбора города, поиска точки на карте и нажатия по ней.
 *
 * Модуль без импортов: правила отбора должны проверяться тестами без базы
 * и сети.
 */

/** Радиус Земли в километрах. */
const EARTH_RADIUS_KM = 6371

/**
 * На каком расстоянии заправка считается «той самой».
 *
 * Триста метров: точность геолокации в городе — десятки метров, а
 * заправки редко стоят ближе трёхсот друг к другу. Больший радиус привёл
 * бы к отметкам не на той АЗС, меньший — к «рядом ничего нет» у человека,
 * стоящего у самой колонки.
 */
export const MATCH_RADIUS_KM = 0.3

/**
 * Сколько заправок предлагать на выбор.
 *
 * Когда рядом несколько, бот спрашивает какая — но список из десяти
 * кнопок читается дольше, чем открывается карта, и смысл теряется. Три
 * ближайшие покрывают почти все случаи.
 */
export const MAX_CHOICES = 3

export type BotStation = {
  id: string
  name: string
  latitude: number
  longitude: number
}

/** Расстояние по прямой в километрах. */
export function distanceKm(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
): number {
  const toRad = (value: number) => (value * Math.PI) / 180
  const dLat = toRad(to.latitude - from.latitude)
  const dLon = toRad(to.longitude - from.longitude)
  const a =
    Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(from.latitude)) * Math.cos(toRad(to.latitude)) * Math.sin(dLon / 2) ** 2
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export type MatchResult =
  /** Одна заправка рядом — спрашиваем сразу про неё. */
  | { kind: "single"; station: BotStation; km: number }
  /** Несколько рядом — просим выбрать. */
  | { kind: "choice"; stations: Array<{ station: BotStation; km: number }> }
  /** Ничего рядом: человек не на заправке или её нет в справочнике. */
  | { kind: "none" }

/**
 * Находит заправку по присланной точке.
 *
 * Одна в радиусе — сразу она: лишний вопрос «эта?» при единственном
 * варианте только отнимает нажатие.
 */
export function matchStation(
  point: { latitude: number; longitude: number },
  stations: readonly BotStation[],
): MatchResult {
  const near = stations
    .map((station) => ({ station, km: distanceKm(point, station) }))
    .filter((row) => row.km <= MATCH_RADIUS_KM)
    .sort((left, right) => left.km - right.km)

  if (near.length === 0) return { kind: "none" }
  if (near.length === 1) return { kind: "single", station: near[0].station, km: near[0].km }

  return { kind: "choice", stations: near.slice(0, MAX_CHOICES) }
}

/** Данные для разбора нажатия на кнопку бота. */
export type BotAction =
  | { kind: "fuel"; stationId: string; fuel: string; state: "YES" | "NO" }
  | { kind: "queue"; stationId: string; queue: "NONE" | "SMALL" | "BIG" }
  | { kind: "station"; stationId: string }
  | { kind: "done"; stationId: string }

/**
 * Разбирает данные кнопки.
 *
 * Формат короткий: Telegram ограничивает callback_data 64 байтами, а
 * идентификатор точки вида «osm-node-1234567890» занимает двадцать. Всё
 * остальное — однобуквенные пометки.
 */
export function parseAction(data: string): BotAction | null {
  const parts = data.split(":")
  if (parts[0] !== "f") return null

  const kind = parts[1]
  const stationId = parts[2]
  if (!stationId || !/^[a-z]+-[a-z]+-\d+$/i.test(stationId)) return null

  if (kind === "y" || kind === "n") {
    const fuel = parts[3]
    if (!fuel) return null
    return { kind: "fuel", stationId, fuel, state: kind === "y" ? "YES" : "NO" }
  }

  if (kind === "q") {
    const queue = parts[3]
    if (queue !== "NONE" && queue !== "SMALL" && queue !== "BIG") return null
    return { kind: "queue", stationId, queue }
  }

  if (kind === "s") return { kind: "station", stationId }
  if (kind === "d") return { kind: "done", stationId }

  return null
}

/** Собирает данные кнопки — короче 64 байт. */
export function buildAction(action: BotAction): string {
  if (action.kind === "fuel") {
    return `f:${action.state === "YES" ? "y" : "n"}:${action.stationId}:${action.fuel}`
  }
  if (action.kind === "queue") return `f:q:${action.stationId}:${action.queue}`
  if (action.kind === "station") return `f:s:${action.stationId}`
  return `f:d:${action.stationId}`
}

/** Расстояние словами — для строки «в 120 м от вас». */
export function formatDistance(km: number): string {
  if (km < 1) {
    const meters = Math.max(Math.round((km * 1000) / 10) * 10, 10)
    return `${meters} м`
  }
  return `${km.toFixed(1).replace(".", ",")} км`
}
