/**
 * Приведение города объявления к названию из справочника.
 *
 * Город в объявлении — это свободный текст: форма подачи принимает
 * что угодно. Замер боевой базы 16 сентября 2026: из двадцати
 * уникальных локаций шесть не совпадали со справочником — «уфа»
 * строчными, «йошкар ола» без дефиса, «rustavi» латиницей,
 * «Давлеканово, Республика Башкортостан» с довеском, «Альметьевск,
 * Казань» с двумя городами разом.
 *
 * Цена этому — потерянная выдача. Фильтр каталога ищет через `contains`,
 * а он в SQLite считается с регистром: человек выбирал «Уфа» в списке и
 * видел четыре объявления из шести. Два уфимских продавца получали ноль
 * просмотров по своему же городу.
 *
 * Здесь решается только распознавание. Чинить надо в трёх местах сразу:
 * этот модуль приводит текст к справочнику, форма подачи предлагает
 * выбор из списка, а поиск в каталоге перестаёт зависеть от регистра.
 */

// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { CITY_COORDINATES } from "./cities.ts"

/* Справочник в нижнем регистре строится один раз: городов несколько
   сотен, и перебирать их на каждое объявление незачем. */
const CITY_BY_LOWER = new Map<string, string>()
for (const city of Object.keys(CITY_COORDINATES)) {
  CITY_BY_LOWER.set(city.toLocaleLowerCase("ru-RU"), city)
}

/* Дефис и пробел в названиях взаимозаменяемы для человека, но не для
   поиска: «йошкар ола» и «Йошкар-Ола» — один город. Ключ без них
   ловит обе записи. */
function collapseKey(value: string): string {
  return value
    .toLocaleLowerCase("ru-RU")
    .replace(/ё/g, "е")
    .replace(/[\s-]+/g, "")
    .trim()
}

const CITY_BY_COLLAPSED = new Map<string, string>()
for (const city of Object.keys(CITY_COORDINATES)) {
  const key = collapseKey(city)
  /* Первый выигрывает: если два города дают одинаковый ключ, второй не
     перепишет чужое имя. */
  if (!CITY_BY_COLLAPSED.has(key)) CITY_BY_COLLAPSED.set(key, city)
}

/**
 * Узнаёт город справочника в том, что написал человек.
 *
 * Возвращает `null`, когда узнать не удалось: выдумывать город нельзя.
 * «rustavi» — это Рустави в Грузии, и приписать его к российскому
 * справочнику значило бы соврать о том, где стоит машина.
 */
export function matchKnownCity(raw: string | null | undefined): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed) return null

  /* Точное совпадение — самый частый случай, проверяется первым. */
  const exact = CITY_BY_LOWER.get(trimmed.toLocaleLowerCase("ru-RU"))
  if (exact) return exact

  const collapsed = CITY_BY_COLLAPSED.get(collapseKey(trimmed))
  if (collapsed) return collapsed

  /* Довесок после запятой: «Давлеканово, Республика Башкортостан».
     Берётся первая часть — человек пишет город, а потом уточнение.

     «Альметьевск, Казань» разбирается так же и даёт Альметьевск. Это
     честнее, чем сдаться: машина стоит в первом названном городе, а
     второе продавец приписал по своим соображениям. */
  const head = trimmed.split(",")[0]?.trim()
  if (head && head !== trimmed) {
    const byHead = CITY_BY_COLLAPSED.get(collapseKey(head))
    if (byHead) return byHead
  }

  return null
}

/**
 * Приводит город к справочнику, оставляя исходный текст при неудаче.
 *
 * Не потерять написанное важнее, чем привести к единому виду: за
 * «Гафурийский район село красноусольск» стоит живое объявление, и
 * стереть эту строку значит спрятать машину вовсе.
 */
export function normalizeListingCity(raw: string | null | undefined): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  return matchKnownCity(trimmed) ?? trimmed
}
