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
const MAX_VARIANTS = 6

/**
 * Русские названия марок и их написание в каталоге.
 *
 * Марки хранятся латиницей — «Lada (ВАЗ)», «Toyota», «Kia». Человек же ищет
 * так, как привык говорить: «лада», «тойота», «киа». Замер на живом сайте
 * это подтвердил: «Lada» находила два объявления, «лада» — ноль.
 *
 * Список короткий и покрывает то, что реально ищут в России. Разворачивать
 * каждое слово по правилам транслитерации нельзя: «мазда» и «Mazda» так ещё
 * совпадут, а «шкода» и «Skoda» — уже нет.
 */
const BRAND_ALIASES: Record<string, string> = {
  лада: "Lada",
  ваз: "Lada",
  тойота: "Toyota",
  ниссан: "Nissan",
  хендай: "Hyundai",
  хундай: "Hyundai",
  киа: "Kia",
  мазда: "Mazda",
  хонда: "Honda",
  мицубиси: "Mitsubishi",
  митсубиси: "Mitsubishi",
  субару: "Subaru",
  сузуки: "Suzuki",
  фольксваген: "Volkswagen",
  ауди: "Audi",
  бмв: "BMW",
  мерседес: "Mercedes-Benz",
  опель: "Opel",
  шкода: "Skoda",
  рено: "Renault",
  пежо: "Peugeot",
  ситроен: "Citroen",
  форд: "Ford",
  шевроле: "Chevrolet",
  вольво: "Volvo",
  лексус: "Lexus",
  хавал: "Haval",
  чери: "Chery",
  джили: "Geely",
  гели: "Geely",
  экзид: "Exeed",
  газель: "ГАЗ",
  уаз: "УАЗ",
  камаз: "КАМАЗ",

  // Ходовые модели: их называют по-русски так же часто, как марки.
  приора: "Priora",
  гранта: "Granta",
  веста: "Vesta",
  калина: "Kalina",
  ларгус: "Largus",
  нива: "Niva",
  солярис: "Solaris",
  рио: "Rio",
  крета: "Creta",
  камри: "Camry",
  королла: "Corolla",
  логан: "Logan",
  дастер: "Duster",
  октавия: "Octavia",
  поло: "Polo",
}

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

  const lower = trimmed.toLowerCase()
  const candidates = [
    trimmed,
    lower,
    trimmed.toUpperCase(),
    // «камаз» → «Камаз»: так пишут марки в объявлениях.
    trimmed.charAt(0).toUpperCase() + lower.slice(1),
  ]

  // «лада» → «Lada»: в каталоге марки записаны латиницей.
  const alias = BRAND_ALIASES[lower]
  if (alias) candidates.push(alias, alias.toUpperCase())

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
