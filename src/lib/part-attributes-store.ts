import { prisma } from "@/lib/prisma"
import { detectProductGroup, normalizeAttributeValue, PRODUCT_GROUP_BY_KEY, readProductAttributes, type ProductGroup } from "@/lib/product-groups"

/**
 * Группа и характеристики из формы продавца.
 *
 * Группу продавец выбирает сам; не выбрал — узнаём по названию. Поля,
 * которых нет в группе, отбрасываются: произвольный ключ превратил бы
 * таблицу характеристик в свалку. Пустая форма — значения из названия,
 * как при импорте прайса.
 */
export function resolvePartAttributes(input: { name: string; productGroup?: unknown; attributes?: unknown }) {
  const explicit = typeof input.productGroup === "string" ? PRODUCT_GROUP_BY_KEY.get(input.productGroup) ?? null : null
  const group: ProductGroup | null = input.productGroup === "" ? null : explicit ?? detectProductGroup(input.name)
  if (!group) return { group: null, values: [] }

  const submitted = input.attributes && typeof input.attributes === "object" ? input.attributes as Record<string, unknown> : null
  const hasSubmitted = submitted && Object.values(submitted).some((value) => value !== "" && value !== null && value !== undefined)
  if (!submitted || !hasSubmitted) return { group, values: readProductAttributes(group, input.name) }

  const values = group.attributes.flatMap((def) => {
    const raw = submitted[def.key]
    if (raw === undefined || raw === null || raw === "") return []
    if (typeof raw !== "string" && typeof raw !== "number") return []
    const value = normalizeAttributeValue(def, raw)
    return value ? [value] : []
  })
  return { group, values }
}

/** Заменяет характеристики позиции целиком: форма присылает полный набор. */
export async function replacePartAttributes(partId: string, values: Array<{ key: string; num: number | null; text: string | null }>) {
  await prisma.$transaction([
    prisma.partAttribute.deleteMany({ where: { partId } }),
    ...(values.length ? [prisma.partAttribute.createMany({ data: values.map((value) => ({ partId, ...value })) })] : []),
  ])
}
