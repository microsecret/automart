import { prisma } from "@/lib/prisma"
import { CITY_COORDINATES } from "@/lib/cities"
import { toCitySlug } from "@/lib/fuel-city-slug"

/**
 * Города, у которых есть своя страница с ценами на топливо.
 *
 * Страницы существовали, но на них не вело ни одной ссылки с сайта:
 * поисковик находил их только через карту сайта, без внутреннего веса.
 * Такая страница-сирота ранжируется в разы хуже связанной, и это была
 * самая крупная потеря трафика в проекте — при том что сами страницы
 * сделаны хорошо: цены в разметке, заголовок, разметка данных.
 *
 * Порог тот же, что у самой страницы: город с десятком заправок
 * отвечает на запрос пустотой, и поисковик справедливо считает такую
 * страницу мусорной.
 */

/** Столько же требует и сама городская страница, иначе ссылка вела бы в никуда. */
const MIN_STATIONS_FOR_PAGE = 15

export type FuelCityLink = {
  city: string
  slug: string
  stationCount: number
}

/**
 * Города с наибольшим числом заправок — для общей страницы карты.
 *
 * Читает срез по городам одним запросом: перебирать справочник и
 * спрашивать базу по каждому названию значило бы сотни запросов на
 * страницу.
 */
export async function listFuelCities(limit = 60): Promise<FuelCityLink[]> {
  const rows = await prisma.fuelStationImport.groupBy({
    by: ["city"],
    _count: { _all: true },
    orderBy: { _count: { city: "desc" } },
    take: limit * 2,
  })

  const result: FuelCityLink[] = []
  for (const row of rows) {
    const city = row.city?.trim()
    if (!city || row._count._all < MIN_STATIONS_FOR_PAGE) continue
    /* Трассы между городами подписаны «Трасса, Урал» и своей страницы не
       имеют: у них нет ни координат в справочнике, ни смысла в запросе
       «цены на бензин в …». */
    if (!(city in CITY_COORDINATES)) continue

    result.push({ city, slug: toCitySlug(city), stationCount: row._count._all })
    if (result.length >= limit) break
  }

  return result
}

/**
 * Ближайшие города со своими страницами.
 *
 * Человек, смотрящий цены в Первоуральске, скорее всего поедет через
 * Екатеринбург, а не через Казань. Ссылки на соседей полезны ему и
 * связывают страницы в сеть для поисковика.
 */
export async function listNearbyFuelCities(city: string, limit = 8): Promise<FuelCityLink[]> {
  const origin = CITY_COORDINATES[city]
  if (!origin) return []

  const candidates = await listFuelCities(200)

  return candidates
    .filter((candidate) => candidate.city !== city && candidate.city in CITY_COORDINATES)
    .map((candidate) => {
      const point = CITY_COORDINATES[candidate.city]
      /* Расстояние считается по плоскости: на дистанциях в сотни
         километров этого достаточно, чтобы отличить соседний город от
         другого конца страны, а точность здесь не нужна вовсе. */
      const dx = (point.latitude - origin.latitude) * 111
      const dy = (point.longitude - origin.longitude) * 111 * Math.cos((origin.latitude * Math.PI) / 180)
      return { ...candidate, distanceKm: Math.hypot(dx, dy) }
    })
    .sort((left, right) => left.distanceKm - right.distanceKm)
    .slice(0, limit)
    .map(({ city: name, slug, stationCount }) => ({ city: name, slug, stationCount }))
}
