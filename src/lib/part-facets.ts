import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { formatAttributeValue, type ProductGroup } from "@/lib/product-groups"

/* Числовая характеристика с немногими значениями (ёмкость 55/60/62/74,
   диаметр 15/16/17) удобнее кнопками, чем «от–до»: человек знает, какая
   ему нужна. Больше — уже диапазон. */
const CHIP_LIMIT = 14

export type Facet =
  | { key: string; label: string; unit?: string; type: "chips"; values: Array<{ value: string; label: string; count: number }> }
  | { key: string; label: string; unit?: string; type: "range"; min: number; max: number }

/**
 * Разбирает фильтры характеристик из адреса: `a_capacity=55|60` или
 * `a_capacity=50..70`. Ключи без определения в группе отбрасываются —
 * произвольный ключ иначе превращался бы в запрос по чужому полю.
 */
export function attributeFilters(group: ProductGroup, params: URLSearchParams): Prisma.PartWhereInput[] {
  const filters: Prisma.PartWhereInput[] = []
  for (const def of group.attributes) {
    const raw = params.get(`a_${def.key}`)?.trim()
    if (!raw) continue
    if (def.kind === "number" && raw.includes("..")) {
      const [from, to] = raw.split("..").map((value) => (value.trim() ? Number(value.replace(",", ".")) : undefined))
      const num: Prisma.FloatNullableFilter = {}
      if (from !== undefined && Number.isFinite(from)) num.gte = from
      if (to !== undefined && Number.isFinite(to)) num.lte = to
      if (Object.keys(num).length) filters.push({ attributes: { some: { key: def.key, num } } })
      continue
    }
    const values = raw.split("|").map((value) => value.trim()).filter(Boolean).slice(0, 30)
    if (!values.length) continue
    if (def.kind === "number") {
      const numbers = values.map((value) => Number(value.replace(",", "."))).filter(Number.isFinite)
      if (numbers.length) filters.push({ attributes: { some: { key: def.key, num: { in: numbers } } } })
    } else {
      filters.push({ attributes: { some: { key: def.key, text: { in: values } } } })
    }
  }
  return filters
}

/** Значения характеристик в текущей выдаче — для колонки фильтров. */
export async function loadFacets(group: ProductGroup, where: Prisma.PartWhereInput): Promise<Facet[]> {
  const defs = group.attributes.filter((def) => def.filter)
  if (!defs.length) return []
  const rows = await prisma.partAttribute.groupBy({
    by: ["key", "num", "text"],
    where: { key: { in: defs.map((def) => def.key) }, part: where },
    _count: { _all: true },
    take: 3_000,
  })

  const facets: Facet[] = []
  for (const def of defs) {
    const own = rows.filter((row) => row.key === def.key)
    if (!own.length) continue
    if (def.kind === "number") {
      const numbers = own.filter((row) => row.num !== null)
      if (!numbers.length) continue
      if (numbers.length <= CHIP_LIMIT) {
        facets.push({
          key: def.key, label: def.label, unit: def.unit, type: "chips",
          values: numbers
            .sort((a, b) => (a.num as number) - (b.num as number))
            .map((row) => ({ value: String(row.num), label: formatAttributeValue(def, { num: row.num, text: null }), count: row._count._all })),
        })
      } else {
        const values = numbers.map((row) => row.num as number)
        facets.push({ key: def.key, label: def.label, unit: def.unit, type: "range", min: Math.min(...values), max: Math.max(...values) })
      }
      continue
    }
    const order = def.options?.map((option) => option.value) ?? []
    const texts = own.filter((row) => row.text)
    if (!texts.length) continue
    facets.push({
      key: def.key, label: def.label, type: "chips",
      values: texts
        .sort((a, b) => {
          const ai = order.indexOf(a.text as string)
          const bi = order.indexOf(b.text as string)
          if (ai >= 0 || bi >= 0) return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi)
          return b._count._all - a._count._all || String(a.text).localeCompare(String(b.text), "ru")
        })
        .slice(0, 40)
        .map((row) => ({ value: row.text as string, label: row.text as string, count: row._count._all })),
    })
  }
  return facets
}
