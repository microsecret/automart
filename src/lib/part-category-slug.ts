import { PART_TYPES } from "@/lib/constants"

/**
 * Адреса категорий запчастей.
 *
 * Категории жили только в query-параметрах: `/parts-finder?partType=ENGINE`.
 * Поисковики такие адреса за отдельные страницы не считают, поэтому запрос
 * «купить двигатель бу» вести было некуда — весь раздел представлен одной
 * страницей поиска без единого слова о том, что в нём можно найти.
 *
 * Слаги заданы вручную, а не транслитерацией: адрес читает человек и
 * набирает в поиске, и `dvigatel` он поймёт хуже, чем `engine`, зато
 * `podveska` — лучше, чем `suspension`. Выбрано то, что чаще пишут в
 * поисковой строке рядом со словом «запчасти».
 */

const SLUG_BY_TYPE: Readonly<Record<string, string>> = {
  ENGINE: "dvigatel",
  TRANSMISSION: "transmissiya",
  SUSPENSION: "podveska",
  BRAKES: "tormoza",
  ELECTRICAL: "elektrika",
  BODY: "kuzov",
  INTERIOR: "salon",
  WHEELS: "kolesa-i-diski",
  LIGHTING: "optika",
  COOLING: "ohlazhdenie",
  EXHAUST: "vyhlopnaya-sistema",
  STEERING: "rulevoe-upravlenie",
  ACCESSORIES: "aksessuary",
  CONSUMABLES: "rashodniki",
}

const TYPE_BY_SLUG = new Map<string, string>()
for (const [type, slug] of Object.entries(SLUG_BY_TYPE)) TYPE_BY_SLUG.set(slug, type)

export function partCategorySlug(partType: string): string | null {
  return SLUG_BY_TYPE[partType] ?? null
}

export function partTypeFromSlug(slug: string): string | null {
  return TYPE_BY_SLUG.get(slug.toLowerCase()) ?? null
}

export function partCategoryLabel(partType: string): string | null {
  return PART_TYPES.find((row) => row.value === partType)?.label ?? null
}

/**
 * Категории, у которых есть своя страница.
 *
 * «Другое» сюда не входит намеренно: страница «Запчасти категории Другое»
 * не отвечает ни на один живой запрос, а в выдаче выглядит заглушкой.
 */
export function partCategoriesWithPages(): Array<{ partType: string; slug: string; label: string }> {
  return PART_TYPES.flatMap((row) => {
    const slug = SLUG_BY_TYPE[row.value]
    return slug ? [{ partType: row.value, slug, label: row.label }] : []
  })
}
