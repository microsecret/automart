import type { Prisma } from "@prisma/client"
import { containsAnyCase } from "@/lib/search-terms"
import { PUBLIC_PART_WHERE } from "@/lib/parts-catalog-offers"
import { PRODUCT_GROUP_BY_KEY } from "@/lib/product-groups"
import { attributeFilters } from "@/lib/part-facets"

const list = (value: string | null) => Array.from(new Set((value || "").split(",").map((item) => item.trim()).filter(Boolean)))

/**
 * Условия выдачи запчастей по строке запроса подписки — те же фильтры, что
 * на странице поиска: группа, узел, машина, производитель, цена, наличие,
 * состояние, характеристики.
 *
 * Нужны рассылке «Сообщить о поступлении»: считать надо позиции, которые
 * человек увидит по своей ссылке, а не весь новый каталог.
 */
export function partsWhereFromQuery(query: string): Prisma.PartWhereInput {
  const params = new URLSearchParams(query)
  const and: Prisma.PartWhereInput[] = [PUBLIC_PART_WHERE]

  const group = PRODUCT_GROUP_BY_KEY.get(params.get("group") || "")
  if (group) {
    and.push({ OR: [{ productGroup: group.key }, { subcategory: group.subcategory }] })
    and.push(...attributeFilters(group, params))
  }
  const partType = params.get("partType")
  if (partType) and.push({ partType })
  const subcategory = params.get("subcategory")
  if (subcategory) and.push({ subcategory })

  const make = params.get("make")
  const model = params.get("model")
  if (make) {
    and.push({
      OR: [
        { make: { contains: make }, ...(model ? { model: { contains: model } } : {}) },
        { compatibility: { some: { make: { contains: make }, ...(model ? { model: { contains: model } } : {}) } } },
      ],
    })
  }

  const brands = list(params.get("brand"))
  if (brands.length) and.push({ brandName: { in: brands } })

  const priceFrom = Number(params.get("priceFrom"))
  const priceTo = Number(params.get("priceTo"))
  if (params.get("priceFrom") && Number.isFinite(priceFrom)) and.push({ price: { gte: priceFrom } })
  if (params.get("priceTo") && Number.isFinite(priceTo)) and.push({ price: { lte: priceTo } })

  const availability = list(params.get("availability"))
  if (availability.length) {
    const variants: Prisma.PartWhereInput[] = [{ storeId: null, availability: { in: availability } }]
    if (availability.includes("IN_STOCK")) variants.push({ storeId: null, availability: null }, { storeId: { not: null }, supplyMode: "STOCK" })
    if (availability.includes("ON_ORDER")) variants.push({ storeId: { not: null }, supplyMode: "ORDER" })
    and.push({ OR: variants })
  }

  const conditions = list(params.get("conditions"))
  if (conditions.length) and.push({ condition: { in: conditions } })

  const q = params.get("q")?.trim()
  if (q) {
    const compact = q.toUpperCase().replace(/[^A-Z0-9А-ЯЁ]/g, "")
    and.push({
      OR: [
        ...containsAnyCase("name", q),
        { oemNumber: { contains: q.toUpperCase() } },
        ...(compact.length >= 3 ? [{ crossReferences: { some: { normalizedNumber: { contains: compact } } } }] : []),
      ] as Prisma.PartWhereInput["OR"],
    })
  }

  return { AND: and }
}

/**
 * «Новое» для подписки: позиция создана после отметки — или её магазин
 * изменился после неё (опубликованный магазин выкладывает весь каталог
 * разом, а позиции были созданы ещё в черновике).
 */
export function newPartsSince(since: Date): Prisma.PartWhereInput {
  return { OR: [{ createdAt: { gt: since } }, { store: { status: "ACTIVE", updatedAt: { gt: since } } }] }
}
