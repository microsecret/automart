/**
 * Расстояние между точками и поиск городов в радиусе.
 *
 * Нужно для запроса «покажи машины не дальше 200 км от меня»: человек готов
 * съездить за хорошим вариантом в соседний город, но не через полстраны.
 * На крупных площадках это привычный фильтр, у нас его не было — поиск шёл
 * по точному совпадению названия города.
 */

export type GeoPoint = { latitude: number; longitude: number }

/** Средний радиус Земли, километры. */
const EARTH_RADIUS_KM = 6371

/** Радиусы, которые предлагаются человеку. Дальше 500 км ехать за машиной уже не едут. */
export const SEARCH_RADII_KM = [50, 100, 200, 300, 500] as const

export type SearchRadius = typeof SEARCH_RADII_KM[number]

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180
}

/**
 * Расстояние по прямой между двумя точками, километры.
 *
 * Формула гаверсинуса — она считает по дуге шара, а не по плоскости. Для
 * России это принципиально: на широте Мурманска градус долготы вдвое короче,
 * чем на широте Сочи, и плоский расчёт ошибался бы на сотни километров.
 *
 * Дорожное расстояние всегда больше прямого — примерно на четверть. Для
 * фильтра «рядом» этого достаточно: человеку важен порядок величины, а не
 * точный километраж маршрута.
 */
export function distanceKm(from: GeoPoint, to: GeoPoint): number {
  const dLat = toRadians(to.latitude - from.latitude)
  const dLon = toRadians(to.longitude - from.longitude)
  const lat1 = toRadians(from.latitude)
  const lat2 = toRadians(to.latitude)

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2)

  return Math.round(2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a)))
}

/**
 * Города в пределах радиуса от заданной точки.
 *
 * Возвращает названия, отсортированные по удалённости: ближние города
 * человек рассматривает охотнее дальних, и выдача должна начинаться с них.
 *
 * Исходный город входит в результат — иначе фильтр «в радиусе 100 км»
 * спрятал бы объявления из самого города, где человек живёт.
 */
export function citiesWithinRadius(
  origin: GeoPoint,
  radiusKm: number,
  cities: Record<string, GeoPoint>,
): string[] {
  const withDistance: { name: string; distance: number }[] = []

  for (const [name, point] of Object.entries(cities)) {
    const distance = distanceKm(origin, point)
    if (distance <= radiusKm) withDistance.push({ name, distance })
  }

  withDistance.sort((a, b) => a.distance - b.distance)
  return withDistance.map((item) => item.name)
}

/**
 * Приводит радиус к одному из предложенных значений.
 *
 * Радиус приходит из адреса страницы, то есть человек может подставить туда
 * что угодно. Произвольное число разворачивалось бы в запрос по сотням
 * городов — принимаем только знакомые значения.
 */
export function parseRadius(value: string | null | undefined): SearchRadius | null {
  if (!value) return null
  const parsed = Number.parseInt(value, 10)
  return (SEARCH_RADII_KM as readonly number[]).includes(parsed) ? (parsed as SearchRadius) : null
}
