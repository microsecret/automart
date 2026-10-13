import type { Prisma } from "@prisma/client"
import { containsAnyCase } from "@/lib/search-terms"

/**
 * Условия выдачи по строке подписки — для объявлений и аукционов.
 *
 * Рассылка считала все новые записи раздела, не глядя на фильтры:
 * подписчик на «Toyota Camry до 2 млн» получал «появилось 5 новых
 * вариантов», и по ссылке не находил ни одного. Здесь — основные фильтры
 * страниц: марка, модель, цена, год, топливо, коробка, кузов, страна,
 * текст. Редкие фильтры не учитываются: лучше лишнее уведомление, чем
 * пропущенная подходящая машина.
 */

const int = (value: string | null) => {
  if (!value) return undefined
  const number = Number.parseInt(value, 10)
  return Number.isFinite(number) ? number : undefined
}
const values = (raw: string | null) => (raw || "").split(",").map((item) => item.trim()).filter(Boolean)

export function listingsWhereFromQuery(query: string): Prisma.ListingWhereInput {
  const params = new URLSearchParams(query)
  const and: Prisma.ListingWhereInput[] = []
  const vehicle: Prisma.VehicleWhereInput[] = []

  const type = params.get("type")
  if (type === "vehicle") and.push({ vehicleId: { not: null } })
  if (type === "part") and.push({ partId: { not: null } })

  const vehicleType = params.get("vehicleType")
  if (vehicleType) vehicle.push({ vehicleType })
  const make = params.get("make")
  if (make) vehicle.push({ OR: containsAnyCase("make", make) as Prisma.VehicleWhereInput["OR"] })
  const model = params.get("model")
  if (model) vehicle.push({ OR: containsAnyCase("model", model) as Prisma.VehicleWhereInput["OR"] })
  const yearFrom = int(params.get("yearFrom"))
  const yearTo = int(params.get("yearTo"))
  if (yearFrom !== undefined || yearTo !== undefined) vehicle.push({ year: { ...(yearFrom !== undefined ? { gte: yearFrom } : {}), ...(yearTo !== undefined ? { lte: yearTo } : {}) } })
  const mileageTo = int(params.get("mileageTo"))
  if (mileageTo !== undefined) vehicle.push({ mileage: { lte: mileageTo } })
  const fuel = values(params.get("fuelType"))
  if (fuel.length) vehicle.push({ fuelType: { in: fuel } })
  const transmission = params.get("transmission")
  if (transmission) vehicle.push({ transmission })
  const body = values(params.get("bodyType"))
  if (body.length) vehicle.push({ bodyType: { in: body } })
  const drive = params.get("driveType")
  if (drive) vehicle.push({ driveType: drive })
  if (vehicle.length) and.push({ vehicle: { AND: vehicle } })

  const priceFrom = int(params.get("priceFrom"))
  const priceTo = int(params.get("priceTo"))
  if (priceFrom !== undefined || priceTo !== undefined) and.push({ price: { ...(priceFrom !== undefined ? { gte: priceFrom } : {}), ...(priceTo !== undefined ? { lte: priceTo } : {}) } })

  /* Город — у машины или у запчасти: у самого объявления его нет. */
  const city = params.get("city")?.trim()
  if (city) and.push({ OR: [{ vehicle: { location: { contains: city } } }, { part: { location: { contains: city } } }] })

  const q = params.get("q")?.trim()
  if (q) {
    and.push({
      OR: [
        ...containsAnyCase("title", q),
        { vehicle: { OR: [...containsAnyCase("make", q), ...containsAnyCase("model", q)] } },
        { part: { OR: [...containsAnyCase("name", q), ...containsAnyCase("make", q), ...containsAnyCase("model", q)] } },
      ] as Prisma.ListingWhereInput["OR"],
    })
  }
  return and.length ? { AND: and } : {}
}

export function auctionsWhereFromQuery(query: string): Prisma.AuctionListingWhereInput {
  const params = new URLSearchParams(query)
  const and: Prisma.AuctionListingWhereInput[] = []
  const country = params.get("country")
  if (country) and.push({ country })
  const source = params.get("source")
  if (source) and.push({ source })
  const make = params.get("make")
  if (make) and.push({ OR: containsAnyCase("make", make) as Prisma.AuctionListingWhereInput["OR"] })
  const model = params.get("model")
  if (model) and.push({ OR: containsAnyCase("model", model) as Prisma.AuctionListingWhereInput["OR"] })
  const body = params.get("bodyType")
  if (body) and.push({ bodyType: body })
  const yearFrom = int(params.get("yearFrom"))
  if (yearFrom !== undefined) and.push({ year: { gte: yearFrom } })
  const priceFrom = int(params.get("priceFrom"))
  const priceTo = int(params.get("priceTo"))
  if (priceFrom !== undefined || priceTo !== undefined) and.push({ finalPrice: { ...(priceFrom !== undefined ? { gte: priceFrom } : {}), ...(priceTo !== undefined ? { lte: priceTo } : {}) } })
  const q = params.get("q")?.trim()
  if (q) and.push({ OR: [...containsAnyCase("make", q), ...containsAnyCase("model", q)] as Prisma.AuctionListingWhereInput["OR"] })
  return and.length ? { AND: and } : {}
}
