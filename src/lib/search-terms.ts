/**
 * Варианты написания поискового запроса.
 *
 * База проекта — SQLite, и здесь у поиска две особенности. Prisma не
 * поддерживает `mode: "insensitive"` для этого движка вовсе, а встроенный
 * `LIKE` игнорирует регистр только для латиницы: «lada» найдёт «Lada», но
 * «камаз» не найдёт «КАМАЗ».
 *
 * Замер на живом сайте: «КАМАЗ» — одно объявление, «камаз» — ноль. «Lada» —
 * два, «лада» — ноль. Люди пишут строчными, то есть поиск не работал для
 * большинства реальных запросов.
 *
 * Добавлять колонку с нормализованным текстом значило бы миграцию боевой
 * базы ради одной задачи. Вместо этого запрос разворачивается в несколько
 * написаний: их немного, а условие остаётся обычным `contains`.
 */

/** Больше вариантов не нужно: они лишь удлиняют запрос к базе. */
const MAX_VARIANTS = 4

/**
 * Написания запроса, которые стоит проверить.
 *
 * Возвращает исходную строку и её варианты по регистру, без повторов.
 * Для латиницы SQLite и так не различает регистр, но лишний вариант
 * отсеивается сравнением, а не проверкой алфавита — так проще и надёжнее.
 */
export function searchVariants(query: string): string[] {
  const trimmed = query.trim()
  if (!trimmed) return []

  const candidates = [
    trimmed,
    trimmed.toLowerCase(),
    trimmed.toUpperCase(),
    // «камаз» → «Камаз»: так пишут марки в объявлениях.
    trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase(),
  ]

  const seen = new Set<string>()
  const result: string[] = []
  for (const candidate of candidates) {
    if (seen.has(candidate)) continue
    seen.add(candidate)
    result.push(candidate)
    if (result.length >= MAX_VARIANTS) break
  }
  return result
}

/**
 * Условия `contains` по одному полю для всех написаний запроса.
 *
 * Пример: `containsAnyCase("make", "камаз")` даст условия для «камаз»,
 * «КАМАЗ» и «Камаз» — этого достаточно, чтобы найти объявление независимо
 * от того, как продавец записал марку.
 */
export function containsAnyCase(field: string, query: string): Record<string, { contains: string }>[] {
  return searchVariants(query).map((variant) => ({ [field]: { contains: variant } }))
}
