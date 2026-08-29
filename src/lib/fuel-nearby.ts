/**
 * Ближайшие заправки с нужным топливом.
 *
 * Карта отвечает на вопрос «что вокруг», а человеку за рулём нужен
 * другой: «куда ехать за 92-м прямо сейчас». Разглядывать метки на карте
 * в движении неудобно и небезопасно — нужен список, отсортированный по
 * расстоянию, где первая строка и есть ответ.
 *
 * Модуль без импортов: правила отбора должны проверяться тестами без базы
 * и без карты.
 */

/** Радиус Земли в километрах — для расчёта расстояния по прямой. */
const EARTH_RADIUS_KM = 6371

/**
 * Расстояние по прямой между двумя точками, в километрах.
 *
 * По прямой, а не по дорогам: маршрут считает навигатор, а здесь нужно
 * лишь упорядочить заправки. Разница в городе редко меняет порядок первых
 * трёх, а честный маршрут потребовал бы платного маршрутизатора на каждую
 * точку списка.
 */
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

/**
 * Расстояние словами.
 *
 * До километра — в метрах с округлением до полусотни: «до заправки 350 м»
 * человек понимает сразу, а «0.35 км» приходится переводить в уме.
 */
export function formatDistance(km: number): string {
  if (km < 1) {
    const meters = Math.round((km * 1000) / 50) * 50
    return `${Math.max(meters, 50)} м`
  }
  if (km < 10) return `${km.toFixed(1).replace(".", ",")} км`
  return `${Math.round(km)} км`
}

export type NearbyStation = {
  id: string
  name: string
  latitude: number
  longitude: number
}

export type NearbyAvailability = {
  fuel: string
  state: string
  updatedAt: string | null
}

export type NearbyResult = {
  station: NearbyStation
  km: number
  /** Есть ли нужное топливо по свежим отметкам. */
  hasFuel: boolean
  /** Когда отметили в последний раз; null — не отмечали вовсе. */
  updatedAt: string | null
}

/**
 * Сортирует заправки под вопрос «куда ехать за этой маркой».
 *
 * Порядок продуман: сначала те, где топливо есть, — по расстоянию; потом
 * те, где не отмечали, — тоже по расстоянию; заправки с отметкой «нет»
 * уходят в конец.
 *
 * Неотмеченные не выбрасываются: отсутствие сведений — не отсутствие
 * топлива, и ближайшая неотмеченная заправка может оказаться лучшим
 * вариантом, когда все отмеченные далеко.
 */
export function sortByFuelAndDistance(
  stations: readonly NearbyStation[],
  origin: { latitude: number; longitude: number },
  availabilityByStation: Readonly<Record<string, readonly NearbyAvailability[]>>,
  fuel: string,
): NearbyResult[] {
  const rows: Array<NearbyResult & { rank: number }> = stations.map((station) => {
    const rows = availabilityByStation[station.id] ?? []
    const known = rows.find((row) => row.fuel === fuel)

    /* Три состояния, три места в списке: есть → не знаем → нет. */
    const rank = known?.state === "YES" ? 0 : known?.state === "NO" ? 2 : 1

    return {
      station,
      km: distanceKm(origin, station),
      hasFuel: known?.state === "YES",
      updatedAt: known?.updatedAt ?? null,
      rank,
    }
  })

  rows.sort((left, right) => (left.rank !== right.rank ? left.rank - right.rank : left.km - right.km))

  return rows.map(({ rank: _rank, ...rest }) => rest)
}
