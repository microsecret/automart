/**
 * Приведение марки автомобиля к справочнику брендов.
 *
 * Марка в объявлении — свободный текст, и база это показывает. Замер
 * 17 сентября 2026: ВАЗ записан пятью способами — «Lada», «Lada (ВАЗ)»,
 * «Vaz», «Ваз», «Лада». Opel тремя: «Opel», «OPEL», «OPEL VIVARO».
 * Kia двумя: «Kia» и «kia». Сорок две машины дали двадцать шесть
 * вариантов написания там, где марок на деле вдвое меньше.
 *
 * Цена этому — рассыпанный каталог. Фильтр по марке ищет точное
 * совпадение: выбрал «Lada (ВАЗ)» — не увидел «Ваз» и «Лада». Страница
 * бренда показывает часть своих машин. Сравнение цен с аукционными
 * лотами не находит ничего, потому что там своя россыпь: и «Toyota», и
 * «TOYOTA», и «HONDA» рядом с «Honda».
 *
 * Это та же болезнь, что была у городов, и лечится так же: привести при
 * записи, подсказать в форме, разово прогнать накопленное.
 */

// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { ALL_BRANDS } from "./catalog.ts"

/*
 * Ключ сравнения: регистр, пробелы и дефисы не значат ничего.
 *
 * «Mercedes-Benz» и «mercedes benz» — одна марка. Латинская «a» и
 * кириллическая «а» выглядят одинаково, но это разные буквы: источники
 * этим грешат, и без приведения «Тоyota» со смешанной раскладкой
 * осталась бы отдельной маркой.
 */
const LOOKALIKE_LETTERS: Readonly<Record<string, string>> = {
  а: "a", в: "b", е: "e", к: "k", м: "m", н: "h", о: "o",
  р: "p", с: "c", т: "t", у: "y", х: "x",
}

function makeKey(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("ru-RU")
    .replace(/ё/g, "е")
    .split("")
    .map((letter) => LOOKALIKE_LETTERS[letter] ?? letter)
    .join("")
    .replace(/[\s\-_()]+/g, "")
}

/*
 * Написания, которых нет в справочнике, но которые встречаются в базе.
 *
 * Здесь только то, что реально видно в данных, а не всё вообразимое:
 * список должен расти по замеру, а не по фантазии. Ключи уже приведены
 * функцией выше, поэтому регистр и пробелы в них роли не играют.
 */
const EXTRA_ALIASES: Readonly<Record<string, string>> = {
  lada: "Lada (ВАЗ)",
  ваз: "Lada (ВАЗ)",
  vaz: "Lada (ВАЗ)",
  лада: "Lada (ВАЗ)",
  ладаваз: "Lada (ВАЗ)",
  газ: "ГАЗ",
  gaz: "ГАЗ",
  уаз: "УАЗ",
  uaz: "УАЗ",
  kamaz: "КамАЗ",
  мерседес: "Mercedes-Benz",
  мерседесбенц: "Mercedes-Benz",
  фольксваген: "Volkswagen",
  вольво: "Volvo",
  шкода: "Skoda",
  рено: "Renault",
  ниссан: "Nissan",
  тойота: "Toyota",
  хендай: "Hyundai",
  хёндай: "Hyundai",
  киа: "Kia",
  опель: "Opel",
}

/* Справочник строится один раз: брендов несколько сотен, перебирать их
   на каждое объявление незачем. */
const BRAND_BY_KEY = new Map<string, string>()
for (const brand of ALL_BRANDS) {
  const key = makeKey(brand.name)
  /* Первый выигрывает: если два бренда дают одинаковый ключ, второй не
     перепишет чужое имя. */
  if (!BRAND_BY_KEY.has(key)) BRAND_BY_KEY.set(key, brand.name)
}
for (const [alias, canonical] of Object.entries(EXTRA_ALIASES)) {
  const key = makeKey(alias)
  if (!BRAND_BY_KEY.has(key)) BRAND_BY_KEY.set(key, canonical)
}

/**
 * Узнаёт марку справочника в том, что написал человек.
 *
 * Возвращает `null`, когда узнать не удалось: выдумывать марку нельзя.
 * «Apollo» в базе есть, а в справочнике нет — приписать её к похожей
 * значило бы соврать о том, что продаётся.
 */
export function matchKnownMake(raw: string | null | undefined): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed) return null

  const exact = BRAND_BY_KEY.get(makeKey(trimmed))
  if (exact) return exact

  /* Марка с приклеенной моделью: «VOLKSWAGEN POLO», «OPEL VIVARO».
     Источники и продавцы пишут так сплошь и рядом. Берётся самое
     длинное совпадение по началу строки, иначе «Land Rover» опознается
     как «Land».

     Проверяются только слова, а не любые обрезки: «Ford» не должен
     находиться внутри «Fordson». */
  const words = trimmed.split(/\s+/)
  for (let count = words.length; count > 0; count -= 1) {
    const candidate = BRAND_BY_KEY.get(makeKey(words.slice(0, count).join(" ")))
    if (candidate) return candidate
  }

  return null
}

/**
 * Приводит марку к справочнику, оставляя исходный текст при неудаче.
 *
 * Не потерять написанное важнее, чем привести к единому виду: за
 * незнакомой маркой стоит живое объявление, и стереть её значит
 * спрятать машину вовсе.
 */
export function normalizeListingMake(raw: string | null | undefined): string | null {
  if (!raw) return null
  const trimmed = raw.trim().replace(/\s+/g, " ")
  if (!trimmed) return null
  return matchKnownMake(trimmed) ?? trimmed
}
