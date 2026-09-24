import { NextRequest, NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { auctionSourceCountry, isAuctionSource } from "@/lib/auction-sources"
import { AUCTION_BODY_TYPES } from "@/lib/auction-normalization"
import { buildPublicAuctionPolicy } from "@/lib/auction-public-catalog"
import { containsAnyCase } from "@/lib/search-terms"

export const dynamic = "force-dynamic"

const VALID_COUNTRIES = new Set(["JP", "KR", "CN", "US", "DE"])
const VALID_BODY_TYPES = new Set<string>(AUCTION_BODY_TYPES)

/**
 * The public navigation used the human-facing "EU" alias before auctions
 * adopted ISO country codes. Keep old bookmarks working, but use one
 * canonical value for validation and filtering below.
 */
function normalizeCountry(value: string | null) {
  return value === "EU" ? "DE" : value
}

/* Сводки каталога держатся в памяти процесса.

   Восемь агрегатов — средняя и крайние цены, медиана, разбивка по маркам,
   источникам, топливу и кузовам — считались заново на каждое
   пролистывание, хотя от номера страницы не зависят вовсе. Замер на
   боевой базе: 321 мс на запрос; на копии с десятикратным объёмом
   группировка по марке одна занимала 242 мс.

   Числа меняются не чаще, чем работает парсер — раз в двадцать минут.
   Пяти минут хранения достаточно, чтобы каталог оставался живым, а
   пролистывание перестало стоить восьми проходов по таблице.

   Ключ кэша — набор фильтров: у каждой комбинации свои сводки. */
const ANALYTICS_TTL_MS = 5 * 60 * 1000
const ANALYTICS_CACHE_LIMIT = 64

type AnalyticsPayload = {
  total: number
  averageFinalPrice: number | null
  medianFinalPrice: number | null
  minFinalPrice: number | null
  maxFinalPrice: number | null
  averageYear: number | null
  averageMileage: number | null
  powerKnown: number
  mileageKnown: number
  popularMakes: Array<{ make: string; count: number }>
  sources: Array<{ source: string; count: number }>
  fuelDistribution: Array<{ fuelType: string; count: number }>
  bodyDistribution: Array<{ bodyType: string; count: number }>
}

const analyticsCache = new Map<string, { at: number; payload: AnalyticsPayload }>()

function readAnalyticsCache(key: string): AnalyticsPayload | null {
  const hit = analyticsCache.get(key)
  if (!hit) return null
  if (Date.now() - hit.at >= ANALYTICS_TTL_MS) {
    analyticsCache.delete(key)
    return null
  }
  return hit.payload
}

function writeAnalyticsCache(key: string, payload: AnalyticsPayload): void {
  /* Набор фильтров задаёт человек, поэтому число ключей ничем не
     ограничено сверху. Держим последние — редкие сочетания вытесняются
     первыми, а обычные (без фильтров, по стране) остаются. */
  if (analyticsCache.size >= ANALYTICS_CACHE_LIMIT) {
    const oldest = analyticsCache.keys().next().value
    if (oldest !== undefined) analyticsCache.delete(oldest)
  }
  analyticsCache.set(key, { at: Date.now(), payload })
}

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams
    /* Потолок номера страницы обязателен.

       Без него `?page=99999999` проходит все проверки: значение целое и
       положительное. База получает смещение в двадцать миллиардов и
       делает полный проход по таблице — на копии базы это 2.2 секунды.
       Несколько таких запросов подряд занимают единственное соединение
       с SQLite, и сайт перестаёт отвечать. */
    const page = Math.min(10_000, Math.max(1, Number.parseInt(sp.get("page") || "1", 10) || 1))
    const limit = Math.min(50, Math.max(1, Number.parseInt(sp.get("limit") || "20", 10) || 20))
    const skip = (page - 1) * limit

    /* Короткий ответ для витрин и сводок.
     *
     * Замер боевого ответа на двадцать лотов: 110 КБ, из них 109 — поле
     * images со списком всех снимков каждой машины, по 5,5 КБ на лот.
     * Странице аукционов этот список нужен для галереи, витрине на
     * главной и колонке сводки — нет: там показывают один снимок из
     * imageUrl, название и цену.
     *
     * Полный ответ остаётся ответом по умолчанию: параметр включает
     * урезанный, а не наоборот. Иначе страница, о которой забыли,
     * молча лишилась бы половины полей. */
    const brief = sp.get("view") === "brief"

    const publicPolicy = buildPublicAuctionPolicy()
    const where: Prisma.AuctionListingWhereInput = { ...publicPolicy.where }
    const country = normalizeCountry(sp.get("country"))
    const source = sp.get("source")
    const make = sp.get("make")
    const priceFrom = sp.get("priceFrom")
    const priceTo = sp.get("priceTo")
    const yearFrom = sp.get("yearFrom")
    const maxImportAgeYears = publicPolicy.maxImportAgeYears
    // The parser excludes over-age lots on import, but the public read path
    // must enforce the same catalogue policy too. This keeps an old record
    // from becoming visible if it originated from a different importer.
    const minimumImportYear = publicPolicy.minimumImportYear

    if (country && !VALID_COUNTRIES.has(country)) return NextResponse.json({ error: "Некорректная страна" }, { status: 400 })
    if (source && !isAuctionSource(source)) return NextResponse.json({ error: "Некорректная площадка" }, { status: 400 })
    if (country && source && auctionSourceCountry(source) !== country) return NextResponse.json({ error: "Площадка не относится к выбранной стране" }, { status: 400 })
    if (country) where.country = country
    if (source) where.source = source
    /* Поиск по марке не различает регистр и понимает русские названия.

       SQLite сравнивает строки посимвольно: «toyota» строчными не
       находило ничего, а «Toyota» находило. Тот же разбор применяется в
       объявлениях и знает соответствия вроде «тойота» → Toyota. */
    if (make) {
      const variants = containsAnyCase("make", make)
      if (variants.length) {
        /* Отдельным условием, а не в where.OR: политика показа лотов уже
           занимает OR под срок аукциона и скрытие модератором. Запись
           поверх открыла бы скрытые лоты. */
        where.AND = [...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []), { OR: variants }]
      }
    }
    const minPrice = priceFrom ? Number.parseInt(priceFrom, 10) : undefined
    const maxPrice = priceTo ? Number.parseInt(priceTo, 10) : undefined
    if ((priceFrom && !Number.isFinite(minPrice)) || (priceTo && !Number.isFinite(maxPrice))) return NextResponse.json({ error: "Цена должна быть целым числом" }, { status: 400 })
    if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) return NextResponse.json({ error: "Цена от не может быть больше цены до" }, { status: 400 })
    if (priceFrom || priceTo) {
      where.finalPrice = {}
      if (minPrice !== undefined) where.finalPrice.gte = minPrice
      if (maxPrice !== undefined) where.finalPrice.lte = maxPrice
    }
    let requestedYearFrom: number | undefined
    if (yearFrom) {
      const parsedYear = Number.parseInt(yearFrom, 10)
      if (!Number.isInteger(parsedYear) || parsedYear < 1886 || parsedYear > new Date().getFullYear() + 1) return NextResponse.json({ error: "Некорректный год" }, { status: 400 })
      requestedYearFrom = parsedYear
    }
    where.year = { gte: Math.max(minimumImportYear, requestedYearFrom ?? minimumImportYear) }
    // `manufacturedMonth` is optional. A record without a precise month stays
    // in the boundary year and is explicitly marked for documentary review;
    // a record with a known older month is reliably excluded here.
    const bodyType = sp.get("bodyType")
    if (bodyType && !VALID_BODY_TYPES.has(bodyType)) return NextResponse.json({ error: "Некорректный тип кузова" }, { status: 400 })
    if (bodyType) where.bodyType = bodyType

    /* Ключ кэша — набор фильтров: у каждой комбинации свои сводки.

       Время в ключе округляется до десяти минут. Правила показа лотов
       содержат границу свежести «сейчас минус 36 часов» с точностью до
       миллисекунды, и JSON.stringify(where) давал новый ключ на каждый
       запрос: кэш сводок не срабатывал ни разу, а семь проходов по
       таблице лотов шли на каждый заход (замер 24.09.2026 — 415 мс на
       страницу каталога против 5–20 мс у остальных API). Для средних
       цен и распределений по маркам сдвиг границы на минуты ничего не
       меняет. */
    const analyticsKey = JSON.stringify(where).replace(
      /"(\d{4}-\d{2}-\d{2}T\d{2}:\d)\d:\d{2}\.\d{3}Z"/g,
      (_match, prefix: string) => `"${prefix}0"`,
    )
    const cachedAnalytics = readAnalyticsCache(analyticsKey)

    /* Считать ли сводки в этом запросе.
     *
     * Семь из девяти запросов к базе здесь — аналитика: средние,
     * медиана, распределения по маркам, источникам, топливу и кузову.
     * Они выполнялись всегда, даже когда результат лежал в кэше или
     * когда спрашивала витрина, которой сводки не нужны вовсе.
     *
     * Замер боевого ответа: 1,2 секунды на двадцать лотов. Основная
     * доля — эти семь проходов по таблице в 16 тысяч строк. */
    const needAnalytics = !cachedAnalytics && !brief

    /* Лоты и счётчик нужны всегда — это и есть ответ. */
    const [listings, total] = await prisma.$transaction([
      prisma.auctionListing.findMany({
        where, skip, take: limit,
        /* Поля перечислены поимённо.

           Раньше отдавались все сорок семь колонок, включая наценку
           площадки, закупочную цену, курс пересчёта и прямую ссылку на
           первоисточник: покупатель видел, сколько зарабатывает площадка,
           и уходил к источнику напрямую.

           Второй ключ сортировки — идентификатор. Без него порядок между
           лотами с одинаковой датой не определён, и при вставке новых
           лотов парсером записи повторялись на границе страниц. */
        select: brief
          ? {
              /* Ровно то, что рисуют витрина и сводка: имя, цена,
                 страна, один снимок. */
              id: true, make: true, model: true, year: true, mileage: true,
              finalPrice: true, priceRub: true, country: true,
              imageUrl: true, createdAt: true,
            }
          : {
          id: true, make: true, model: true, year: true, mileage: true,
          finalPrice: true, priceRub: true, country: true, source: true,
          imageUrl: true, images: true, bodyType: true, fuelType: true,
          color: true, power: true, engineVolume: true, transmission: true,
          auctionDate: true, lotNumber: true, viewCount: true,
          conditionInfo: true, manufacturedMonth: true, createdAt: true,
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      }),
      prisma.auctionListing.count({ where }),
    ])

    /* Сводки — отдельной транзакцией и только по надобности.
       Пустой массив вместо результатов, когда считать не нужно. */
    const [aggregates, popularMakes, sourceDistribution, fuelDistribution, bodyDistribution, powerKnown, mileageKnown] = needAnalytics
      ? await prisma.$transaction([
      prisma.auctionListing.aggregate({
        where,
        _avg: { finalPrice: true, year: true, mileage: true },
        _min: { finalPrice: true },
        _max: { finalPrice: true },
      }),
      prisma.auctionListing.groupBy({
        by: ["make"],
        where,
        _count: true,
        orderBy: { _count: { make: "desc" } },
        take: 8,
      }),
      prisma.auctionListing.groupBy({
        by: ["source"],
        where,
        _count: true,
        orderBy: { _count: { source: "desc" } },
      }),
      prisma.auctionListing.groupBy({
        by: ["fuelType"],
        where,
        _count: true,
        orderBy: { _count: { fuelType: "desc" } },
      }),
      prisma.auctionListing.groupBy({
        by: ["bodyType"],
        where,
        _count: true,
        orderBy: { _count: { bodyType: "desc" } },
      }),
      prisma.auctionListing.count({ where: { ...where, power: { not: null } } }),
      prisma.auctionListing.count({ where: { ...where, mileage: { not: null } } }),
        ])
      : [null, [], [], [], [], 0, 0] as const

    // Average price is sensitive to premium lots. The median is an additional
    // factual reference for the active filters, calculated without guessing a
    // market price or using listings outside the current result set.
    const middleOffset = Math.floor(Math.max(0, total - 1) / 2)
    // При попадании в кэш медиану считать незачем: она уже в сводках.
    const medianRows = needAnalytics && total > 0
      ? await prisma.auctionListing.findMany({
          where,
          orderBy: { finalPrice: "asc" },
          skip: middleOffset,
          take: total % 2 === 0 ? 2 : 1,
          select: { finalPrice: true },
        })
      : []
    const medianFinalPrice = medianRows.length
      ? Math.round(medianRows.reduce((sum, row) => sum + row.finalPrice, 0) / medianRows.length)
      : null

    /* В кратком режиме сводок нет вовсе: витрина их не читает, а
       считать было нечем — аналитические запросы пропущены. */
    const analytics: AnalyticsPayload | null = brief ? null : cachedAnalytics || {
      total,
      averageFinalPrice: aggregates && aggregates._avg.finalPrice ? Math.round(aggregates._avg.finalPrice) : null,
      medianFinalPrice,
      minFinalPrice: aggregates?._min.finalPrice ?? null,
      maxFinalPrice: aggregates?._max.finalPrice ?? null,
      averageYear: aggregates && aggregates._avg.year ? Math.round(aggregates._avg.year) : null,
      averageMileage: aggregates && aggregates._avg.mileage ? Math.round(aggregates._avg.mileage) : null,
      powerKnown,
      mileageKnown,
      popularMakes: popularMakes.map((item) => ({ make: item.make, count: Number(item._count) })),
      sources: sourceDistribution.map((item) => ({ source: item.source, count: Number(item._count) })),
      fuelDistribution: fuelDistribution.flatMap((item) => item.fuelType ? [{ fuelType: item.fuelType, count: Number(item._count) }] : []),
      bodyDistribution: bodyDistribution.flatMap((item) => item.bodyType ? [{ bodyType: item.bodyType, count: Number(item._count) }] : []),
    }
    if (!cachedAnalytics && analytics) writeAnalyticsCache(analyticsKey, analytics)

    return NextResponse.json({
      listings,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      importPolicy: {
        maxAgeYears: maxImportAgeYears,
        minimumYear: minimumImportYear,
        note: "Правило каталога для предварительного импорта; таможенную категорию и дату выпуска необходимо сверить по документам.",
      },
      analytics,
    })
  } catch (error) {
    console.error("Auctions GET error:", error)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
