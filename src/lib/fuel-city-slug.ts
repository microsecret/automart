import { CITY_COORDINATES } from "@/lib/cities"

/**
 * Адреса городских страниц карты АЗС.
 *
 * Карта жила по одному адресу на всю страну, и по запросу «цены на бензин
 * в Уфе» поисковик вести на неё было некуда: заголовок обещал Россию, а
 * города в адресе не было вовсе. Городская страница отвечает ровно на этот
 * вопрос — и заголовком, и адресом, и содержимым.
 *
 * Слаг строится транслитерацией: латиница в адресе читается человеком и
 * не превращается в мешанину процентов при копировании ссылки.
 */

const TRANSLIT: Readonly<Record<string, string>> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z",
  и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
  с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sch",
  ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
}

export function toCitySlug(city: string): string {
  return city
    .toLocaleLowerCase("ru-RU")
    .split("")
    .map((letter) => (letter in TRANSLIT ? TRANSLIT[letter] : letter))
    .join("")
    /* Пробелы и дефисы сводятся к одному дефису: «Набережные Челны» и
       «Ростов-на-Дону» должны давать читаемый адрес, а не подчёркивания. */
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

/* Обратное соответствие строится один раз: городов несколько сотен, и
   перебирать их на каждый запрос страницы незачем. */
const CITY_BY_SLUG = new Map<string, string>()
for (const city of Object.keys(CITY_COORDINATES)) {
  const slug = toCitySlug(city)
  /* Первый выигрывает: если два города дают одинаковый слаг, второй
     останется без своей страницы, но чужую не перепишет. */
  if (!CITY_BY_SLUG.has(slug)) CITY_BY_SLUG.set(slug, city)
}

export function cityFromSlug(slug: string): string | null {
  return CITY_BY_SLUG.get(slug.toLowerCase()) ?? null
}

/**
 * Города с городскими страницами карты.
 *
 * Не весь справочник: страница без данных о заправках отвечает на запрос
 * пустотой, и поисковик справедливо считает её мусорной. Список задаёт тот,
 * кто знает, где сбор работает, — сейчас это целевые регионы скрейпера.
 */
export function fuelCitySlugs(cities: string[]): Array<{ city: string; slug: string }> {
  const seen = new Set<string>()
  const result: Array<{ city: string; slug: string }> = []
  for (const city of cities) {
    const slug = toCitySlug(city)
    if (!slug || seen.has(slug)) continue
    seen.add(slug)
    result.push({ city, slug })
  }
  return result
}

/* Склонение переехало в city-declension: правило не про заправки, и без
   зависимостей его можно проверить тестом напрямую. Реэкспорт оставлен,
   чтобы не править места, которые импортируют функцию отсюда. */
export { cityInPrepositional } from "@/lib/city-declension"
