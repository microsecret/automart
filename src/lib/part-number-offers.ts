import { prisma } from "@/lib/prisma"
import { normalizeOemNumber } from "@/lib/part-import"
import { parseMarketplaceImages } from "@/lib/media-url"
import { PUBLIC_PART_WHERE } from "@/lib/parts-catalog-offers"

export type ArticleOffer = {
  id: string
  name: string
  price: number
  brandName: string | null
  oemNumber: string | null
  image: string | null
  supplyMode: string
  leadTimeDaysMin: number | null
  leadTimeDaysMax: number | null
  condition: string
  store: { name: string; slug: string; city: string | null } | null
  location: string
}

const OFFER_SELECT = {
  id: true, name: true, price: true, brandName: true, oemNumber: true, images: true,
  supplyMode: true, leadTimeDaysMin: true, leadTimeDaysMax: true, condition: true, location: true,
  store: { select: { name: true, slug: true, city: true } },
  crossReferences: { select: { number: true, normalizedNumber: true } },
  compatibility: { select: { make: true, model: true, yearFrom: true, yearTo: true } },
  make: true, model: true, yearFrom: true, yearTo: true,
} as const

/* Артикул печатают как «04465-33450», «04465 33450» и «0446533450».
   Кросс-номера уже хранятся приведёнными, основной номер позиции — нет,
   поэтому сравнение делается выражением в базе. Убираются те же знаки,
   что и в normalizeOemNumber для латинских номеров. */
async function partIdsByOem(numbers: string[]) {
  if (!numbers.length) return []
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `SELECT id FROM "Part" WHERE "oemNumber" IS NOT NULL AND REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(UPPER("oemNumber"), '-', ''), ' ', ''), '.', ''), '/', ''), '_', '') IN (${numbers.map(() => "?").join(",")}) LIMIT 300`,
    ...numbers,
  )
  return rows.map((row) => row.id)
}

function toOffer(part: {
  id: string; name: string; price: number; brandName: string | null; oemNumber: string | null; images: string | null
  supplyMode: string; leadTimeDaysMin: number | null; leadTimeDaysMax: number | null; condition: string; location: string
  store: { name: string; slug: string; city: string | null } | null
}): ArticleOffer {
  return {
    id: part.id, name: part.name, price: part.price, brandName: part.brandName, oemNumber: part.oemNumber,
    image: parseMarketplaceImages(part.images, 1)?.[0] ?? null,
    supplyMode: part.supplyMode, leadTimeDaysMin: part.leadTimeDaysMin, leadTimeDaysMax: part.leadTimeDaysMax,
    condition: part.condition, store: part.store, location: part.location,
  }
}

/**
 * Всё, что продаётся по артикулу: сам номер у разных магазинов и аналоги.
 *
 * Аналог — это позиция, которая заменяет номер: либо в её списке кроссов
 * есть искомый номер, либо её номер указан в кроссах оригинала. Так
 * собирают выдачу автомагазины: три продавца по одному номеру уже выглядят
 * как выбор, даже если магазинов на площадке немного.
 */
export async function loadArticleOffers(raw: string) {
  const number = normalizeOemNumber(raw).slice(0, 64)
  if (number.length < 3) return null

  const originalIds = await partIdsByOem([number])
  const originals = originalIds.length
    ? await prisma.part.findMany({ where: { AND: [PUBLIC_PART_WHERE, { id: { in: originalIds } }] }, select: OFFER_SELECT, take: 200 })
    : []

  /* Номера-заменители из кроссов оригиналов: по ним ищутся позиции
     других производителей. */
  const crossNumbers = Array.from(new Set(originals.flatMap((part) => part.crossReferences.map((cross) => cross.normalizedNumber)))).filter((value) => value !== number).slice(0, 50)
  const [replacingIds, crossOemIds] = await Promise.all([
    prisma.partCrossReference.findMany({ where: { normalizedNumber: number }, select: { partId: true }, take: 300 }).then((rows) => rows.map((row) => row.partId)),
    partIdsByOem(crossNumbers),
  ])
  const originalSet = new Set(originals.map((part) => part.id))
  const analogIds = Array.from(new Set([...replacingIds, ...crossOemIds])).filter((id) => !originalSet.has(id))
  const analogs = analogIds.length
    ? await prisma.part.findMany({ where: { AND: [PUBLIC_PART_WHERE, { id: { in: analogIds } }] }, select: OFFER_SELECT, take: 200 })
    : []

  /* Применимость — из позиций по самому номеру: аналог может подходить
     шире или уже, и смешивать их совместимость нельзя. */
  const applicability = new Map<string, { make: string; model: string; yearFrom: number | null; yearTo: number | null }>()
  for (const part of originals) {
    const rows = [...part.compatibility, { make: part.make, model: part.model, yearFrom: part.yearFrom, yearTo: part.yearTo }]
    for (const row of rows) {
      if (!row.make || row.make === "Универсальная" || row.make === "Universal") continue
      const key = `${row.make}|${row.model}`.toLowerCase()
      if (!applicability.has(key)) applicability.set(key, row)
    }
  }

  const display = originals[0]?.oemNumber || raw.trim().toUpperCase().slice(0, 64)
  const displayCross = Array.from(new Set(originals.flatMap((part) => part.crossReferences.map((cross) => cross.number)))).slice(0, 30)

  return {
    number,
    display,
    originals: originals.map(toOffer),
    analogs: analogs.map(toOffer),
    crossNumbers: displayCross,
    applicability: [...applicability.values()].slice(0, 40),
  }
}
