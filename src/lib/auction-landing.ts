import { prisma } from "@/lib/prisma"
import { buildPublicAuctionPolicy } from "@/lib/auction-public-catalog"
import { auctionMakeLabel } from "@/lib/auction-normalization"
import {
  AUCTION_LANDING_COUNTRIES,
  MIN_LISTINGS_FOR_LANDING,
  makeSlug,
  uniqueAuctionLandingsByPath,
} from "@/lib/auction-landing-routes"

export { AUCTION_LANDING_COUNTRIES, makeSlug } from "@/lib/auction-landing-routes"

// Посадочные страницы «марка + страна» не ведутся вручную: список строится из
// фактического каталога, поэтому новая марка появляется на сайте сразу после
// того, как парсер привёз по ней лоты, а исчезнувшая — уходит из sitemap без
// правки кода.

export type AuctionLanding = {
  countryCode: string
  countrySlug: string
  countryNominative: string
  countryGenitive: string
  make: string
  makeLabel: string
  makeSlug: string
  total: number
}

/**
 * Собирает направления, по которым в каталоге достаточно лотов.
 *
 * Используется и генерацией маршрутов, и sitemap, поэтому набор страниц в
 * индексе всегда совпадает с тем, что реально открывается.
 */
export async function listAuctionLandings(): Promise<AuctionLanding[]> {
  const policy = buildPublicAuctionPolicy()
  const grouped = await prisma.auctionListing.groupBy({
    by: ["country", "make"],
    where: policy.where,
    _count: { _all: true },
  })

  const landings: AuctionLanding[] = []
  for (const row of grouped) {
    const country = AUCTION_LANDING_COUNTRIES[row.country]
    if (!country || row._count._all < MIN_LISTINGS_FOR_LANDING) continue
    const slug = makeSlug(row.make)
    if (!slug) continue
    landings.push({
      countryCode: row.country,
      countrySlug: country.slug,
      countryNominative: country.nominative,
      countryGenitive: country.genitive,
      make: row.make,
      makeLabel: auctionMakeLabel(row.make),
      makeSlug: slug,
      total: row._count._all,
    })
  }

  return uniqueAuctionLandingsByPath(landings)
    .sort((left, right) => right.total - left.total)
}

/** Находит направление по адресу страницы, сверяя его с текущим каталогом. */
export async function findAuctionLanding(countrySlug: string, makeSlug: string) {
  const landings = await listAuctionLandings()
  return landings.find((landing) => landing.countrySlug === countrySlug && landing.makeSlug === makeSlug) || null
}

export type AuctionLandingStats = {
  total: number
  minPrice: number | null
  maxPrice: number | null
  medianPrice: number | null
  averageYear: number | null
  bodyTypes: Array<{ label: string; count: number }>
  models: Array<{ model: string; count: number }>
}

const BODY_LABELS: Readonly<Record<string, string>> = {
  SEDAN: "седан", SUV: "кроссовер", HATCHBACK: "хэтчбек", COUPE: "купе",
  PICKUP: "пикап", WAGON: "универсал", MINIVAN: "минивэн",
}

/**
 * Считает показатели направления по фактическим лотам.
 *
 * Цифры на странице должны совпадать с выдачей: придуманный «средний ценник»
 * обесценивает страницу и для покупателя, и для поисковой системы.
 */
export async function buildAuctionLandingStats(countryCode: string, make: string): Promise<AuctionLandingStats> {
  const policy = buildPublicAuctionPolicy()
  const where = { ...policy.where, country: countryCode, make }

  const [rows, models] = await Promise.all([
    prisma.auctionListing.findMany({
      where,
      select: { finalPrice: true, year: true, bodyType: true },
    }),
    prisma.auctionListing.groupBy({
      by: ["model"],
      where,
      _count: { _all: true },
      orderBy: { _count: { model: "desc" } },
      take: 8,
    }),
  ])

  const prices = rows.map((row) => row.finalPrice).filter((price) => price > 0).sort((a, b) => a - b)
  const years = rows.map((row) => row.year).filter((year): year is number => typeof year === "number" && year > 0)
  const bodyCounts = new Map<string, number>()
  for (const row of rows) {
    if (!row.bodyType) continue
    const label = BODY_LABELS[row.bodyType] || row.bodyType.toLocaleLowerCase("ru-RU")
    bodyCounts.set(label, (bodyCounts.get(label) || 0) + 1)
  }

  return {
    total: rows.length,
    minPrice: prices[0] ?? null,
    maxPrice: prices[prices.length - 1] ?? null,
    medianPrice: prices.length ? prices[Math.floor(prices.length / 2)] : null,
    averageYear: years.length ? Math.round(years.reduce((sum, year) => sum + year, 0) / years.length) : null,
    bodyTypes: [...bodyCounts.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((left, right) => right.count - left.count)
      .slice(0, 4),
    models: models.map((row) => ({ model: row.model, count: row._count._all })),
  }
}
