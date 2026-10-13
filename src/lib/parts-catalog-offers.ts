import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { publicListingWhere } from "@/lib/listing-lifecycle"
import { matchKnownMake } from "@/lib/listing-make"

/* Позиция видна покупателю двумя путями — как в поиске запчастей. */
export const PUBLIC_PART_WHERE: Prisma.PartWhereInput = {
  OR: [
    { listings: { some: publicListingWhere } },
    { store: { status: "ACTIVE" } },
  ],
}

export type OfferRow = { brand: string; model: string; partType: string; subcategory: string | null; count: number }

/* Сколько строк индекса читаем за раз: каталог считает предложения в
   памяти, и рост базы не должен превратить страницу в полный проход. */
const INDEX_LIMIT = 20_000

const sameModel = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

/**
 * Индекс предложений «марка → модель → узел» по всем публичным позициям.
 *
 * Марку продавцы пишут по-разному («TOYOTA», «Тойота Камри»), поэтому она
 * приводится к справочнику; позиция без узнаваемой марки в каталог не
 * попадает — приписывать её к похожей значит соврать о совместимости.
 * Учитываются и основная машина позиции, и список совместимости.
 */
export async function loadOfferIndex(): Promise<OfferRow[]> {
  const [own, compatible] = await Promise.all([
    prisma.part.groupBy({
      by: ["make", "model", "partType", "subcategory"],
      where: PUBLIC_PART_WHERE,
      _count: { _all: true },
      take: INDEX_LIMIT,
      orderBy: { make: "asc" },
    }),
    prisma.partCompatibility.findMany({
      where: { part: PUBLIC_PART_WHERE },
      select: { make: true, model: true, partId: true, part: { select: { make: true, model: true, partType: true, subcategory: true } } },
      take: INDEX_LIMIT,
    }),
  ])

  const counts = new Map<string, OfferRow>()
  const add = (rawMake: string, model: string, partType: string, subcategory: string | null, count: number) => {
    const brand = matchKnownMake(rawMake)
    if (!brand || !model.trim()) return
    const key = `${brand}|${model.trim().toLowerCase()}|${partType}|${subcategory ?? ""}`
    const row = counts.get(key)
    if (row) row.count += count
    else counts.set(key, { brand, model: model.trim(), partType, subcategory, count })
  }
  for (const row of own) add(row.make, row.model, row.partType, row.subcategory, row._count._all)
  for (const row of compatible) {
    /* Совместимость, повторяющая основную машину позиции, не удваивает счёт. */
    if (matchKnownMake(row.make) === matchKnownMake(row.part.make) && sameModel(row.model, row.part.model)) continue
    add(row.make, row.model, row.part.partType, row.part.subcategory, 1)
  }
  return Array.from(counts.values())
}

export function countBy<T extends string>(rows: OfferRow[], pick: (row: OfferRow) => T | null) {
  const result = new Map<T, number>()
  for (const row of rows) {
    const key = pick(row)
    if (key === null) continue
    result.set(key, (result.get(key) ?? 0) + row.count)
  }
  return result
}

/** Свежие позиции для модели — витрина под схемой. */
export async function loadModelParts(brand: string, model: string, take = 12) {
  const token = brand.split(/[\s(]/)[0]
  const candidates = await prisma.part.findMany({
    where: {
      AND: [
        PUBLIC_PART_WHERE,
        { OR: [{ make: { contains: token } }, { compatibility: { some: { make: { contains: token } } } }] },
      ],
    },
    orderBy: { updatedAt: "desc" },
    take: 300,
    select: {
      id: true, name: true, price: true, make: true, model: true, partType: true, subcategory: true,
      brandName: true, oemNumber: true, condition: true, supplyMode: true, leadTimeDaysMin: true, leadTimeDaysMax: true,
      images: true, store: { select: { name: true, slug: true } },
      compatibility: { select: { make: true, model: true } },
    },
  })
  return candidates
    .filter((part) =>
      (matchKnownMake(part.make) === brand && sameModel(part.model, model)) ||
      part.compatibility.some((row) => matchKnownMake(row.make) === brand && sameModel(row.model, model)))
    .slice(0, take)
}

/**
 * Миниатюры моделей для каталога — из наших же лотов аукционов.
 *
 * Образец (chinaspare) показывает фото машины на плитке модели; чужие
 * снимки брать нельзя, а у нас 25 тысяч лотов с фотографиями. Берётся
 * свежий активный лот на модель. Марку лоты пишут по-разному («KIA»,
 * «Kia»), поэтому она сверяется через справочник.
 */
export async function loadModelPhotos(brand: string, models: readonly string[]): Promise<Map<string, string>> {
  const makes = await prisma.auctionListing.groupBy({ by: ["make"], where: { status: "ACTIVE", adminHiddenAt: null }, _count: { _all: true }, orderBy: { make: "asc" }, take: 2_000 })
  const variants = makes.map((row) => row.make).filter((make) => matchKnownMake(make) === brand)
  if (!variants.length) return new Map()

  const lots = await prisma.auctionListing.findMany({
    where: { status: "ACTIVE", adminHiddenAt: null, make: { in: variants }, imageUrl: { not: null } },
    distinct: ["model"],
    orderBy: { createdAt: "desc" },
    take: 400,
    select: { model: true, imageUrl: true },
  })
  /* Корейские площадки пишут модель с приставками и комплектацией:
     «The New K5 3-е поколение 2.0 LPG Prestige». Приставки снимаем, а
     модель ищем отдельным словом — «K5» найдётся, «K5» в «K50» нет. */
  const normalized = lots.map((lot) => ({
    model: ` ${lot.model.toLowerCase().replace(/^(?:the\s+)?(?:all[-\s]?new\s+|new\s+)?/, "").replace(/\s+/g, " ").trim()} `,
    imageUrl: lot.imageUrl as string,
  }))
  const photos = new Map<string, string>()
  for (const model of models) {
    const key = model.toLowerCase().trim()
    /* Точное совпадение, затем лот, где модель — начало названия, затем
       отдельное слово внутри. Обратное («Tiggo» ← «Tiggo 7») не берём:
       на плитке оказалась бы другая машина. */
    const match = normalized.find((lot) => lot.model === ` ${key} `)
      ?? normalized.find((lot) => lot.model.startsWith(` ${key} `))
      ?? normalized.find((lot) => lot.model.includes(` ${key} `))
    if (match) photos.set(model, match.imageUrl)
  }
  return photos
}
