/**
 * Первая страница каталога для серверной отрисовки.
 *
 * Главная и /search строились целиком в браузере: сервер отдавал разметку
 * без единой ссылки на объявление, а карточки дорисовывал SWR уже после
 * загрузки. Поисковый робот видел пустую витрину — 208 КБ разметки, в
 * которой не встречалось ни одного `href="/listings/..."`.
 *
 * Здесь собран только простейший случай — витрина без фильтров, первая
 * страница, сортировка по умолчанию. Именно её открывает робот и человек,
 * пришедший по ссылке. Разбор трёх десятков фильтров остаётся в маршруте
 * /api/listings: как только посетитель что-то выбирает, дальше работает
 * он, а этот модуль отдаёт лишь стартовое наполнение.
 *
 * Выборка полей повторяет маршрут дословно и по той же причине: VIN,
 * госномер и координаты не должны попадать в витрину.
 */

import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { publicListingWhere } from "@/lib/listing-lifecycle"
import { getFuelOptions, supportsTransmission } from "@/lib/constants"

/** Столько же, сколько просит клиент в buildQuery. Маршрут по умолчанию
    отдаёт двенадцать, но витрина запрашивает двадцать явно: возьми мы
    двенадцать — при первой же подгрузке SWR список бы прыгнул. */
export const CATALOG_FIRST_PAGE_LIMIT = 20

/** Ключ SWR, которому соответствуют эти данные: витрина без фильтров,
    первая страница, сортировка по умолчанию. Строка собрана в том же
    порядке, что и в buildQuery — SWR сличает ключи посимвольно. */
export const CATALOG_FIRST_PAGE_KEY =
  "/api/listings?type=vehicle&page=1&limit=20&sort=newest"

const LISTING_SELECT = {
  id: true,
  title: true,
  description: true,
  price: true,
  status: true,
  isFeatured: true,
  promoUntil: true,
  views: true,
  createdAt: true,
  publishedAt: true,
  userId: true,
  vehicle: {
    select: {
      id: true, make: true, model: true, year: true, price: true,
      mileage: true, operatingHours: true, flightHours: true,
      fuelType: true, transmission: true, driveType: true,
      bodyType: true, vehicleType: true, typeDetails: true,
      engineVolume: true, power: true, doors: true, generation: true,
      color: true, condition: true, steeringWheel: true,
      documentsStatus: true, damageInfo: true, customsCleared: true,
      ownersCount: true, sellerType: true, availability: true,
      location: true, images: true, description: true,
      categoryId: true, createdAt: true,
    },
  },
  part: {
    select: {
      id: true, name: true, price: true, condition: true,
      partType: true, images: true, description: true,
      brandName: true, oemNumber: true, availability: true,
      make: true, yearFrom: true, yearTo: true, vehicleType: true,
      saleFormat: true, auctionStatus: true, auctionEndsAt: true,
      auctionCurrentPrice: true, auctionStartPrice: true,
      location: true, storeId: true, createdAt: true,
    },
  },
  user: { select: { id: true, name: true, image: true } },
} satisfies Prisma.ListingSelect

/** Те же поправки, что делает маршрут: коробка и топливо, неприменимые к
    типу техники, гасятся, а место берётся из машины или запчасти. */
function normalizeListing<T extends {
  vehicle?: { location?: string | null; vehicleType?: string | null; transmission?: string | null; fuelType?: string | null } | null
  part?: { location?: string | null } | null
}>(listing: T) {
  const vehicle = listing.vehicle
  const vehicleType = vehicle?.vehicleType || "CAR"
  const allowedFuelTypes = new Set<string>(getFuelOptions(vehicleType).map((item) => item.value))
  const normalizedVehicle = vehicle ? {
    ...vehicle,
    transmission: supportsTransmission(vehicleType) ? vehicle.transmission : null,
    fuelType: vehicle.fuelType && allowedFuelTypes.has(vehicle.fuelType) ? vehicle.fuelType : null,
  } : null

  return {
    ...listing,
    vehicle: normalizedVehicle,
    location: normalizedVehicle?.location || listing.part?.location || null,
  }
}

/**
 * Читает первую страницу витрины.
 *
 * Сбой базы не должен ронять главную: она остаётся рабочей и без
 * стартового наполнения — карточки дорисует браузер, как раньше.
 */
export async function getCatalogFirstPage() {
  try {
    const where: Prisma.ListingWhereInput = { ...publicListingWhere }

    const [listings, total] = await Promise.all([
      prisma.listing.findMany({
        where,
        take: CATALOG_FIRST_PAGE_LIMIT,
        select: LISTING_SELECT,
        /* Два ключа, как в маршруте: при одинаковой дате база возвращает
           записи в произвольном порядке, и он меняется между запросами. */
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      }),
      prisma.listing.count({ where }),
    ])

    return {
      listings: listings.map(normalizeListing),
      pagination: {
        page: 1,
        limit: CATALOG_FIRST_PAGE_LIMIT,
        total,
        pages: Math.ceil(total / CATALOG_FIRST_PAGE_LIMIT),
      },
    }
  } catch (error) {
    console.error("Первая страница каталога:", error)
    return null
  }
}
