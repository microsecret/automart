/* Граница слова в регулярных выражениях ниже записана явно: встроенная
   \b в JavaScript не считает кириллицу буквой, и «6ст», «АКБ», «Вт»
   не находились вовсе. */

/**
 * Товарные группы и их характеристики.
 *
 * У аккумулятора — ёмкость, пусковой ток, полярность и габариты; у масла —
 * вязкость, объём и допуски; у шины — ширина, профиль, диаметр и сезон.
 * Покупатель выбирает по этим числам, а не по названию: так устроены все
 * автомагазины (avtovek02, autodoc), и без этого каталог расходников
 * превращается в список строк, где нужное ищут глазами.
 *
 * Модуль без импортов: правила разбора проверяются тестами без базы.
 * Значения приходят двумя путями — колонками прайса («Ёмкость, Ач») и
 * разбором названия («6ст-62 Ач D23 пуск. ток 600»). Колонка важнее:
 * её заполнил продавец, а разбор названия — догадка.
 */

export type AttributeKind = "number" | "enum" | "text" | "bool"

export type AttributeDef = {
  key: string
  label: string
  kind: AttributeKind
  unit?: string
  /** Канонические значения перечисления и их написания в прайсах. */
  options?: ReadonlyArray<{ value: string; match: RegExp }>
  /** Колонки прайса, из которых берётся значение. */
  aliases?: readonly string[]
  /** Показывать фильтром в списке товаров. */
  filter?: boolean
  /** Выводить в карточке товара в списке (не больше трёх). */
  summary?: boolean
  min?: number
  max?: number
}

export type DepartmentKey = "parts" | "fluids" | "chemicals" | "accessories" | "tires" | "tools"

export type ProductGroup = {
  key: string
  label: string
  department: DepartmentKey
  partType: string
  /** Подкатегория каталога, в которую встаёт товар группы. */
  subcategory: string
  /** Признаки группы в названии или колонке «Категория». */
  detect: RegExp
  attributes: readonly AttributeDef[]
  /** Разбор характеристик из названия товара. */
  extract?: (name: string) => Record<string, string | number>
}

export const DEPARTMENTS: ReadonlyArray<{ key: DepartmentKey; label: string; hint: string }> = [
  { key: "parts", label: "Запчасти", hint: "Двигатель, тормоза, подвеска, фильтры, АКБ" },
  { key: "fluids", label: "Масла и жидкости", hint: "Моторные и трансмиссионные масла, антифриз" },
  { key: "tires", label: "Шины и диски", hint: "Летние, зимние, литые и штампованные диски" },
  { key: "chemicals", label: "Автохимия", hint: "Очистители, полироли, присадки, смазки" },
  { key: "accessories", label: "Аксессуары", hint: "Лампы, щётки, регистраторы, коврики" },
  { key: "tools", label: "Инструменты", hint: "Домкраты, компрессоры, наборы ключей" },
]

/* ---------- разбор чисел ---------- */

const NUM = String.raw`(\d+(?:[.,]\d+)?)`
const toNumber = (value: string) => Number(value.replace(",", "."))

function firstNumber(name: string, pattern: RegExp) {
  const match = name.match(pattern)
  if (!match) return undefined
  const value = toNumber(match[1])
  return Number.isFinite(value) ? value : undefined
}

function put(target: Record<string, string | number>, key: string, value: string | number | undefined) {
  if (value !== undefined && value !== "" && !(typeof value === "number" && !Number.isFinite(value))) target[key] = value
}

/** Объём: «4 л», «4L», «1 литр», «500 мл». Возвращает литры. */
function volumeLiters(name: string) {
  const ml = firstNumber(name, new RegExp(`${NUM}\\s*мл(?:(?<![\\wА-яЁё])(?=[\\wА-яЁё])|(?<=[\\wА-яЁё])(?![\\wА-яЁё]))`, "i"))
  if (ml !== undefined) return Math.round((ml / 1000) * 1000) / 1000
  return firstNumber(name, new RegExp(`${NUM}\\s*(?:л|l|литр(?:а|ов)?)(?![a-zа-я])`, "i"))
}

const opt = (value: string, match: RegExp) => ({ value, match })

/* ---------- общие поля ---------- */

const VOLUME: AttributeDef = { key: "volume", label: "Объём", kind: "number", unit: "л", aliases: ["объем", "объём", "объем, л", "фасовка", "литраж"], filter: true, summary: true, min: 0.05, max: 1000 }
const AXLE: AttributeDef = {
  key: "axle", label: "Ось", kind: "enum", aliases: ["ось", "сторона установки", "установка"], filter: true, summary: true,
  options: [opt("Передняя", /перед|front/i), opt("Задняя", /зад|rear/i)],
}
const LENGTH_MM = (label = "Длина"): AttributeDef => ({ key: "length", label, kind: "number", unit: "мм", aliases: ["длина", "длина, мм", "length"], filter: true, min: 10, max: 2000 })
const WIDTH_MM: AttributeDef = { key: "width", label: "Ширина", kind: "number", unit: "мм", aliases: ["ширина", "ширина, мм", "width"], filter: true, min: 5, max: 1000 }
const HEIGHT_MM: AttributeDef = { key: "height", label: "Высота", kind: "number", unit: "мм", aliases: ["высота", "высота, мм", "height"], filter: true, min: 5, max: 1000 }

const SAE = /(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))(\d{1,2})\s*W\s*[-–]?\s*(\d{2})(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))/i
const saeViscosity = (name: string) => {
  const match = name.match(SAE)
  return match ? `${match[1]}W-${match[2]}` : undefined
}

/* ---------- группы ---------- */

export const PRODUCT_GROUPS: readonly ProductGroup[] = [
  {
    key: "battery", label: "Аккумуляторы", department: "parts", partType: "ELECTRICAL", subcategory: "Аккумулятор",
    detect: /аккумулятор|(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))акб(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))|(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))6\s*ст(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))|battery/i,
    attributes: [
      { key: "capacity", label: "Ёмкость", kind: "number", unit: "Ач", aliases: ["емкость", "ёмкость", "емкость, ач", "ёмкость, ач", "ач"], filter: true, summary: true, min: 1, max: 400 },
      { key: "coldCrank", label: "Пусковой ток", kind: "number", unit: "А", aliases: ["пусковой ток", "пусковой ток, а", "ток холодной прокрутки", "cca", "en"], filter: true, summary: true, min: 20, max: 3000 },
      {
        key: "polarity", label: "Полярность", kind: "enum", aliases: ["полярность"], filter: true, summary: true,
        options: [opt("Обратная (+ справа)", /обр|(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))R\s*\+|\(0\)|(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))0(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))|reverse|(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))оп(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))/i), opt("Прямая (+ слева)", /прям|(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))L\s*\+|\(1\)|(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))1(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))|direct|(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))пп(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))/i)],
      },
      LENGTH_MM(), WIDTH_MM, HEIGHT_MM,
      {
        key: "technology", label: "Технология", kind: "enum", aliases: ["технология", "тип аккумулятора", "тип"], filter: true,
        options: [opt("AGM", /(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))agm(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))/i), opt("EFB", /(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))efb(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))/i), opt("Гелевый", /гел|(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))gel(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))/i), opt("Литий-ионный", /li-?ion|литий/i), opt("Кальциевый", /ca\s*\/\s*ca|кальц/i)],
      },
      {
        key: "terminals", label: "Тип клемм", kind: "enum", aliases: ["клеммы", "тип клемм", "тип выводов"], filter: true,
        options: [opt("Тонкие (азиатские)", /тонк|asia|азия|jis|(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))t3(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))/i), opt("Стандартные", /станд|евро|euro|(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))t1(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))/i)],
      },
      { key: "voltage", label: "Напряжение", kind: "number", unit: "В", aliases: ["напряжение", "напряжение, в"], filter: true, min: 2, max: 48 },
    ],
    extract(name) {
      const result: Record<string, string | number> = {}
      put(result, "capacity", firstNumber(name, /6\s*ст\s*[-–]?\s*(\d{2,3})/i) ?? firstNumber(name, new RegExp(`${NUM}\\s*а\\s*[\\/.]?\\s*[чh]`, "i")))
      put(result, "coldCrank", firstNumber(name, /(?:пуск\.?\w*\s*(?:ток)?|ток|(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))en(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))|cca)\s*[:\-]?\s*(\d{2,4})/i) ?? firstNumber(name, /(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))(\d{3,4})\s*a(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))/i))
      const dims = name.match(/(\d{2,3})\s*[xх×*]\s*(\d{2,3})\s*[xх×*]\s*(\d{2,3})/i)
      if (dims) {
        put(result, "length", Number(dims[1]))
        put(result, "width", Number(dims[2]))
        put(result, "height", Number(dims[3]))
      }
      if (/обр\.?\s*пол|обратн|(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))R\s*\+|\(0\)/i.test(name)) result.polarity = "Обратная (+ справа)"
      else if (/прям\.?\s*пол|прям(ая|ой)|(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))L\s*\+|\(1\)/i.test(name)) result.polarity = "Прямая (+ слева)"
      if (/(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))agm(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))/i.test(name)) result.technology = "AGM"
      else if (/(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))efb(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))/i.test(name)) result.technology = "EFB"
      else if (/гел|(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))gel(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))/i.test(name)) result.technology = "Гелевый"
      /* Типоразмер JIS (B24, D23, D26) — это азиатский корпус с тонкими клеммами. */
      if (/азия|asia|azia|(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))jis(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))|(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))[B-D]\d{2}[LR]?(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))/i.test(name)) result.terminals = "Тонкие (азиатские)"
      put(result, "voltage", firstNumber(name, /(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))(6|12|24)\s*(?:v|в)(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))/i))
      return result
    },
  },
  {
    key: "engine_oil", label: "Моторные масла", department: "fluids", partType: "CONSUMABLES", subcategory: "Моторное масло",
    detect: /моторн\w*\s+масл|масло\s+моторн|engine\s+oil|(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))motor\s*oil|(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))\d{1,2}\s*w\s*-?\s*[2-6]0(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))/i,
    attributes: [
      { key: "viscosity", label: "Вязкость SAE", kind: "text", aliases: ["вязкость", "sae", "класс вязкости"], filter: true, summary: true },
      VOLUME,
      {
        key: "oilBase", label: "Тип масла", kind: "enum", aliases: ["тип масла", "основа", "тип"], filter: true, summary: true,
        options: [opt("Полусинтетическое", /полусинт|semi/i), opt("Синтетическое", /синт|synth|fully|(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))pao(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))/i), opt("Гидрокрекинговое", /гидрокрек|hc/i), opt("Минеральное", /минерал|mineral/i)],
      },
      {
        key: "engine", label: "Двигатель", kind: "enum", aliases: ["тип двигателя", "двигатель"], filter: true,
        options: [opt("Бензиновый и дизельный", /универс|бенз\w*\s*[\/и,]\s*диз/i), opt("Дизельный", /диз|diesel/i), opt("Бензиновый", /бенз|petrol|gasoline/i)],
      },
      { key: "api", label: "Класс API", kind: "text", aliases: ["api", "класс api"], filter: true },
      { key: "acea", label: "Класс ACEA", kind: "text", aliases: ["acea", "класс acea"], filter: true },
      { key: "approvals", label: "Допуски производителей", kind: "text", aliases: ["допуски", "допуск", "одобрения", "approvals"] },
    ],
    extract(name) {
      const result: Record<string, string | number> = {}
      put(result, "viscosity", saeViscosity(name))
      put(result, "volume", volumeLiters(name))
      if (/полусинт|semi/i.test(name)) result.oilBase = "Полусинтетическое"
      else if (/синт|synth|fully/i.test(name)) result.oilBase = "Синтетическое"
      else if (/минерал|mineral/i.test(name)) result.oilBase = "Минеральное"
      const api = name.match(/(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))API\s*([A-Z]{2}(?:[-\s]?\d)?(?:\s*\/\s*[A-Z]{2}(?:-\d)?)?)/)
      if (api) result.api = api[1].replace(/\s+/g, "")
      const acea = name.match(/(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))ACEA\s*([A-E]\d(?:\s*\/\s*[A-E]\d)*)/i)
      if (acea) result.acea = acea[1].replace(/\s+/g, "").toUpperCase()
      if (/diesel|дизел/i.test(name)) result.engine = "Дизельный"
      return result
    },
  },
  {
    key: "transmission_oil", label: "Трансмиссионные масла", department: "fluids", partType: "CONSUMABLES", subcategory: "Трансмиссионное масло",
    detect: /трансмисс\w*\s+масл|масло\s+трансм|(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))atf(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))|(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))cvt(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))|gl-?[345](?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))|(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))(?:70|75|80|85)\s*w\s*-?\s*(?:80|85|90|140)(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))|dexron/i,
    attributes: [
      { key: "viscosity", label: "Вязкость SAE", kind: "text", aliases: ["вязкость", "sae"], filter: true, summary: true },
      VOLUME,
      {
        key: "purpose", label: "Применение", kind: "enum", aliases: ["применение", "назначение"], filter: true, summary: true,
        options: [opt("Вариатор (CVT)", /cvt|вариатор/i), opt("АКПП", /(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))atf(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))|акпп|автомат|dexron/i), opt("МКПП", /мкпп|механ|manual/i), opt("Мосты и редукторы", /мост|редукт|diff|дифф/i)],
      },
      { key: "spec", label: "Спецификация", kind: "text", aliases: ["спецификация", "класс", "gl"], filter: true },
    ],
    extract(name) {
      const result: Record<string, string | number> = {}
      put(result, "viscosity", saeViscosity(name))
      put(result, "volume", volumeLiters(name))
      if (/cvt|вариатор/i.test(name)) result.purpose = "Вариатор (CVT)"
      else if (/(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))atf(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))|акпп|dexron/i.test(name)) result.purpose = "АКПП"
      else if (/мкпп/i.test(name)) result.purpose = "МКПП"
      const spec = name.match(/(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))(GL-?[345](?:\/GL-?[345])?|Dexron\s*[IV]+\w*|Mercon\s*\w+)/i)
      if (spec) result.spec = spec[1].toUpperCase().replace(/^GL(\d)/, "GL-$1")
      return result
    },
  },
  {
    key: "antifreeze", label: "Антифризы", department: "fluids", partType: "CONSUMABLES", subcategory: "Антифриз",
    detect: /антифриз|тосол|охлаждающ\w*\s+жидк|coolant|antifreeze/i,
    attributes: [
      {
        key: "class", label: "Класс", kind: "enum", aliases: ["класс", "спецификация"], filter: true, summary: true,
        options: [opt("G12++", /g\s*12\s*\+\+/i), opt("G12+", /g\s*12\s*\+(?!\+)/i), opt("G13", /g\s*13/i), opt("G12", /g\s*12/i), opt("G11", /g\s*11/i)],
      },
      {
        key: "color", label: "Цвет", kind: "enum", aliases: ["цвет"], filter: true, summary: true,
        options: [opt("Красный", /красн|red/i), opt("Зелёный", /зел[её]н|green/i), opt("Синий", /син|blue/i), opt("Розовый", /розов|pink/i), opt("Фиолетовый", /фиолет|violet|purple/i), opt("Жёлтый", /ж[её]лт|yellow/i), opt("Оранжевый", /оранж|orange/i)],
      },
      VOLUME,
      {
        key: "form", label: "Форма", kind: "enum", aliases: ["форма", "вид"], filter: true,
        options: [opt("Концентрат", /концентр|concentrate/i), opt("Готовый", /готов|ready/i)],
      },
      { key: "freezePoint", label: "Температура замерзания", kind: "number", unit: "°C", aliases: ["температура замерзания", "t замерзания"], filter: true, min: -80, max: 0 },
    ],
    extract(name) {
      const result: Record<string, string | number> = {}
      put(result, "volume", volumeLiters(name))
      const cls = name.match(/g\s*1[1-3]\s*\+{0,2}/i)
      if (cls) result.class = cls[0].replace(/\s+/g, "").toUpperCase()
      if (/концентр/i.test(name)) result.form = "Концентрат"
      put(result, "freezePoint", firstNumber(name, /[-−–]\s*(\d{2})\s*°?\s*c?(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))/i) !== undefined ? -(firstNumber(name, /[-−–]\s*(\d{2})\s*°?\s*c?(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))/i) as number) : undefined)
      return result
    },
  },
  {
    key: "brake_fluid", label: "Тормозные жидкости", department: "fluids", partType: "CONSUMABLES", subcategory: "Тормозная жидкость",
    detect: /тормозн\w*\s+жидк|brake\s+fluid|(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))dot\s*[345]/i,
    attributes: [
      {
        key: "standard", label: "Стандарт", kind: "enum", aliases: ["стандарт", "класс"], filter: true, summary: true,
        options: [opt("DOT 5.1", /dot\s*5[.,]1/i), opt("DOT 5", /dot\s*5(?![.,]1)/i), opt("DOT 4", /dot\s*4/i), opt("DOT 3", /dot\s*3/i)],
      },
      VOLUME,
    ],
    extract(name) {
      const result: Record<string, string | number> = {}
      put(result, "volume", volumeLiters(name))
      const dot = name.match(/dot\s*(5[.,]1|[345])/i)
      if (dot) result.standard = `DOT ${dot[1].replace(",", ".")}`
      return result
    },
  },
  {
    key: "washer_fluid", label: "Омывающие жидкости", department: "fluids", partType: "CONSUMABLES", subcategory: "Омывающая жидкость",
    detect: /омыват|незамерзайк|стеклоомыв|washer/i,
    attributes: [
      {
        key: "season", label: "Сезон", kind: "enum", aliases: ["сезон"], filter: true, summary: true,
        options: [opt("Зимняя", /зим|winter|незамерз|[-−]\s*\d{2}/i), opt("Летняя", /лет|summer/i)],
      },
      { key: "freezePoint", label: "Температура замерзания", kind: "number", unit: "°C", aliases: ["температура замерзания"], filter: true, min: -80, max: 0 },
      VOLUME,
    ],
    extract(name) {
      const result: Record<string, string | number> = {}
      put(result, "volume", volumeLiters(name))
      const freeze = firstNumber(name, /[-−–]\s*(\d{2})\s*°?\s*c?(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))/i)
      if (freeze !== undefined) { result.freezePoint = -freeze; result.season = "Зимняя" }
      else if (/лет|summer/i.test(name)) result.season = "Летняя"
      return result
    },
  },
  {
    key: "tires", label: "Шины", department: "tires", partType: "WHEELS", subcategory: "Шины",
    detect: /(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))шин[аыу]?(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))|покрышк|резин[аы](?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))|(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))tyres?(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))|(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))tires?(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))|(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))\d{3}\s*\/\s*\d{2}\s*z?r\s*\d{2}/i,
    attributes: [
      { key: "width", label: "Ширина профиля", kind: "number", unit: "мм", aliases: ["ширина", "ширина профиля"], filter: true, summary: true, min: 100, max: 400 },
      { key: "profile", label: "Высота профиля", kind: "number", unit: "%", aliases: ["профиль", "высота профиля", "серия"], filter: true, summary: true, min: 20, max: 100 },
      { key: "diameter", label: "Диаметр", kind: "number", unit: "″", aliases: ["диаметр", "посадочный диаметр", "радиус"], filter: true, summary: true, min: 10, max: 24 },
      {
        key: "season", label: "Сезон", kind: "enum", aliases: ["сезон", "сезонность"], filter: true, summary: true,
        options: [opt("Всесезонные", /всесезон|all.?season|4\s*season/i), opt("Зимние", /зим|winter|snow|ice/i), opt("Летние", /лет|summer/i)],
      },
      {
        key: "studded", label: "Шипы", kind: "enum", aliases: ["шипы", "шипованность"], filter: true,
        options: [opt("Нешипованные", /нешип|без\s*шип|фрикц|non.?stud|липучк/i), opt("Шипованные", /шип|stud/i)],
      },
      { key: "loadIndex", label: "Индекс нагрузки", kind: "text", aliases: ["индекс нагрузки"] },
      { key: "speedIndex", label: "Индекс скорости", kind: "text", aliases: ["индекс скорости"], filter: true },
      {
        key: "runflat", label: "RunFlat", kind: "enum", aliases: ["runflat", "ранфлет"], filter: true,
        options: [opt("Да", /^(да|yes|\+|1|runflat|rft)$/i), opt("Нет", /^(нет|no|-|0)$/i)],
      },
    ],
    extract(name) {
      const result: Record<string, string | number> = {}
      const size = name.match(/(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))(\d{3})\s*\/\s*(\d{2})\s*Z?R\s*(\d{2}(?:[.,]5)?)\s*C?\s*(?:(\d{2,3}(?:\/\d{2,3})?)\s*([A-Z]))?/i)
      if (size) {
        put(result, "width", Number(size[1]))
        put(result, "profile", Number(size[2]))
        put(result, "diameter", toNumber(size[3]))
        if (size[4]) result.loadIndex = size[4]
        if (size[5]) result.speedIndex = size[5].toUpperCase()
      }
      if (/всесезон|all.?season/i.test(name)) result.season = "Всесезонные"
      else if (/зим|winter|snow|(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))ice(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))/i.test(name)) result.season = "Зимние"
      else if (/лет|summer/i.test(name)) result.season = "Летние"
      if (/нешип|без\s*шип|non.?stud/i.test(name)) result.studded = "Нешипованные"
      else if (/шип|stud/i.test(name)) result.studded = "Шипованные"
      if (/run\s*-?flat|(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))rft(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))|(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))zp(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))|(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))ssr(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))/i.test(name)) result.runflat = "Да"
      return result
    },
  },
  {
    key: "wheels", label: "Колёсные диски", department: "tires", partType: "WHEELS", subcategory: "Диски",
    detect: /(?:колесн|литой|литые|штампов|кован)\w*\s+диск|диск\w*\s+(?:колесн|литой|литые|штампов|кован)|(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))pcd(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))|(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))et\s*-?\d{1,3}(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё])).*(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))dia(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))|(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))\d{1,2}(?:[.,]5)?\s*j?\s*[xх]\s*\d{2}(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё])).*(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))et(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))/i,
    attributes: [
      { key: "diameter", label: "Диаметр", kind: "number", unit: "″", aliases: ["диаметр", "радиус"], filter: true, summary: true, min: 12, max: 24 },
      { key: "rimWidth", label: "Ширина обода", kind: "number", unit: "″", aliases: ["ширина", "ширина обода", "j"], filter: true, summary: true, min: 4, max: 13 },
      { key: "pcd", label: "Сверловка (PCD)", kind: "text", aliases: ["pcd", "сверловка", "разболтовка"], filter: true, summary: true },
      { key: "et", label: "Вылет (ET)", kind: "number", unit: "мм", aliases: ["et", "вылет"], filter: true, min: -100, max: 150 },
      { key: "dia", label: "Центральное отверстие (DIA)", kind: "number", unit: "мм", aliases: ["dia", "цо", "центральное отверстие", "ступица"], filter: true, min: 40, max: 180 },
      {
        key: "wheelType", label: "Тип диска", kind: "enum", aliases: ["тип диска", "тип"], filter: true,
        options: [opt("Литой", /лит|alloy|cast/i), opt("Кованый", /кован|forged/i), opt("Штампованный", /штамп|steel|сталь/i)],
      },
    ],
    extract(name) {
      const result: Record<string, string | number> = {}
      const size = name.match(/(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))(\d{1,2}(?:[.,]5)?)\s*j?\s*[xх]\s*(\d{2})(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))/i) ?? name.match(/(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))R\s*(\d{2})(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё])).*?(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))(\d{1,2}(?:[.,]5)?)\s*j(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))/i)
      if (size) {
        const [a, b] = [toNumber(size[1]), toNumber(size[2])]
        put(result, "rimWidth", a < b ? a : b)
        put(result, "diameter", a < b ? b : a)
      }
      /* Сверловку ищем среди всех «NxM»: первым в названии обычно стоит
         размер диска (7x17), а не PCD (5x114.3). */
      const pcd = Array.from(name.matchAll(new RegExp(/(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))([3-8])\s*[xх*]\s*(\d{2,3}(?:[.,]\d)?)(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))/i.source, "gi"))).find((match) => Number(match[2].replace(",", ".")) >= 98)
      if (pcd) result.pcd = `${pcd[1]}x${pcd[2].replace(",", ".")}`
      put(result, "et", firstNumber(name, /(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))ET\s*(-?\d{1,3}(?:[.,]\d)?)/i))
      put(result, "dia", firstNumber(name, /(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))(?:DIA|D|ЦО)\s*(\d{2,3}(?:[.,]\d)?)/i))
      if (/лит|alloy/i.test(name)) result.wheelType = "Литой"
      else if (/кован|forged/i.test(name)) result.wheelType = "Кованый"
      else if (/штамп|steel/i.test(name)) result.wheelType = "Штампованный"
      return result
    },
  },
  {
    key: "brake_pads", label: "Тормозные колодки", department: "parts", partType: "BRAKES", subcategory: "Колодки тормозные",
    detect: /колодк|brake\s*pads?/i,
    attributes: [
      AXLE,
      LENGTH_MM(), WIDTH_MM, { key: "thickness", label: "Толщина", kind: "number", unit: "мм", aliases: ["толщина", "толщина, мм"], filter: true, min: 5, max: 40 },
      {
        key: "wearSensor", label: "Датчик износа", kind: "enum", aliases: ["датчик износа"], filter: true,
        options: [opt("Есть", /^(да|есть|yes|\+|с датчик)/i), opt("Нет", /^(нет|no|-|без)/i)],
      },
    ],
    extract(name) {
      const result: Record<string, string | number> = {}
      if (/перед|front/i.test(name)) result.axle = "Передняя"
      else if (/зад|rear/i.test(name)) result.axle = "Задняя"
      if (/с\s*датчик/i.test(name)) result.wearSensor = "Есть"
      return result
    },
  },
  {
    key: "brake_discs", label: "Тормозные диски", department: "parts", partType: "BRAKES", subcategory: "Диски тормозные",
    detect: /тормозн\w*\s+диск|диск\w*\s+тормозн|brake\s+discs?|brake\s+rotors?/i,
    attributes: [
      AXLE,
      { key: "diameter", label: "Диаметр", kind: "number", unit: "мм", aliases: ["диаметр", "диаметр, мм"], filter: true, summary: true, min: 150, max: 450 },
      { key: "thickness", label: "Толщина", kind: "number", unit: "мм", aliases: ["толщина", "толщина, мм"], filter: true, min: 5, max: 50 },
      {
        key: "ventilated", label: "Вентиляция", kind: "enum", aliases: ["вентилируемый", "тип диска"], filter: true, summary: true,
        options: [opt("Невентилируемый", /невент|solid|сплошн/i), opt("Вентилируемый", /вент|vent/i)],
      },
    ],
    extract(name) {
      const result: Record<string, string | number> = {}
      if (/перед|front/i.test(name)) result.axle = "Передняя"
      else if (/зад|rear/i.test(name)) result.axle = "Задняя"
      if (/невент/i.test(name)) result.ventilated = "Невентилируемый"
      else if (/вент|vent/i.test(name)) result.ventilated = "Вентилируемый"
      const dims = name.match(/(\d{3})\s*[xх×*]\s*(\d{1,2}(?:[.,]\d)?)(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))/)
      if (dims) { put(result, "diameter", Number(dims[1])); put(result, "thickness", toNumber(dims[2])) }
      return result
    },
  },
  ...(["oil", "air", "cabin", "fuel"] as const).map((kind): ProductGroup => {
    const meta = {
      oil: { label: "Масляные фильтры", sub: "Фильтр масляный", detect: /фильтр\w*\s+масл|масл\w*\s+фильтр|oil\s+filter/i },
      air: { label: "Воздушные фильтры", sub: "Фильтр воздушный", detect: /фильтр\w*\s+воздуш|воздуш\w*\s+фильтр|air\s+filter/i },
      cabin: { label: "Салонные фильтры", sub: "Фильтр салонный", detect: /фильтр\w*\s+салон|салон\w*\s+фильтр|cabin\s+filter/i },
      fuel: { label: "Топливные фильтры", sub: "Фильтр топливный", detect: /фильтр\w*\s+топлив|топлив\w*\s+фильтр|fuel\s+filter/i },
    }[kind]
    const attributes: AttributeDef[] = kind === "cabin"
      ? [
          { key: "carbon", label: "Угольный", kind: "enum", aliases: ["угольный", "тип"], filter: true, summary: true, options: [opt("Угольный", /угол|carbon|charcoal|^да$/i), opt("Обычный", /обычн|^нет$/i)] },
          LENGTH_MM(), WIDTH_MM, HEIGHT_MM,
        ]
      : [
          HEIGHT_MM,
          { key: "outerDiameter", label: "Наружный диаметр", kind: "number", unit: "мм", aliases: ["наружный диаметр", "диаметр"], filter: true, min: 20, max: 400 },
          { key: "thread", label: "Резьба", kind: "text", aliases: ["резьба", "thread"], filter: kind === "oil" },
        ]
    return {
      key: `${kind}_filter`, label: meta.label, department: "parts", partType: "CONSUMABLES", subcategory: meta.sub,
      detect: meta.detect, attributes,
      extract(name) {
        const result: Record<string, string | number> = {}
        if (kind === "cabin" && /угол|carbon|charcoal/i.test(name)) result.carbon = "Угольный"
        const thread = name.match(/(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))(M\d{2}\s*[xх]\s*\d(?:[.,]\d)?|\d\/\d+["″]?-?\d*\s*UNF)/i)
        if (kind !== "cabin" && thread) result.thread = thread[1].replace(/\s+/g, "").replace("х", "x").toUpperCase()
        return result
      },
    }
  }),
  {
    key: "spark_plugs", label: "Свечи зажигания", department: "parts", partType: "ENGINE", subcategory: "Свечи зажигания",
    detect: /свеч\w*\s+зажиг|свеча(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))|spark\s+plugs?/i,
    attributes: [
      {
        key: "electrode", label: "Электрод", kind: "enum", aliases: ["электрод", "материал электрода"], filter: true, summary: true,
        options: [opt("Иридиевый", /ирид|iridium/i), opt("Платиновый", /платин|platinum/i), opt("Никелевый", /никел|nickel|медн|copper|стандарт/i)],
      },
      { key: "thread", label: "Резьба", kind: "text", aliases: ["резьба"], filter: true, summary: true },
      { key: "gap", label: "Зазор", kind: "number", unit: "мм", aliases: ["зазор"], filter: true, min: 0.3, max: 2.5 },
      { key: "heatRange", label: "Калильное число", kind: "text", aliases: ["калильное число"] },
    ],
    extract(name) {
      const result: Record<string, string | number> = {}
      if (/ирид|iridium/i.test(name)) result.electrode = "Иридиевый"
      else if (/платин|platinum/i.test(name)) result.electrode = "Платиновый"
      const thread = name.match(/(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))M\s*(1[0-8])(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))/i)
      if (thread) result.thread = `M${thread[1]}`
      return result
    },
  },
  {
    key: "wiper_blades", label: "Щётки стеклоочистителя", department: "accessories", partType: "CONSUMABLES", subcategory: "Щётки дворников",
    detect: /щ[её]тк\w*\s+(?:стеклоочист|дворник)|дворник|стеклоочистител|wiper/i,
    attributes: [
      { key: "length", label: "Длина", kind: "number", unit: "мм", aliases: ["длина", "длина, мм", "размер"], filter: true, summary: true, min: 200, max: 1100 },
      {
        key: "bladeType", label: "Тип щётки", kind: "enum", aliases: ["тип", "тип щетки", "конструкция"], filter: true, summary: true,
        options: [opt("Гибридная", /гибрид|hybrid/i), opt("Бескаркасная", /бескаркас|flat|frameless/i), opt("Каркасная", /каркас|frame|conventional/i)],
      },
      { key: "mount", label: "Крепление", kind: "text", aliases: ["крепление", "тип крепления"], filter: true },
    ],
    extract(name) {
      const result: Record<string, string | number> = {}
      const mm = firstNumber(name, /(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))(\d{3})\s*мм/i)
      const inches = firstNumber(name, /(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))(\d{2})\s*(?:["″]|дюйм)/i)
      put(result, "length", mm ?? (inches !== undefined ? Math.round(inches * 25.4 / 25) * 25 : undefined))
      if (/гибрид|hybrid/i.test(name)) result.bladeType = "Гибридная"
      else if (/бескаркас|frameless|flat/i.test(name)) result.bladeType = "Бескаркасная"
      else if (/каркас/i.test(name)) result.bladeType = "Каркасная"
      return result
    },
  },
  {
    key: "bulbs", label: "Автолампы", department: "accessories", partType: "LIGHTING", subcategory: "Лампы",
    detect: /(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))ламп[аы](?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))|автолампа|(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))bulb|(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))(?:H(?:1|3|4|7|8|9|11|15|16|27)|HB[34]|HIR2|D[1-4][SR]|W5W|W21W|P21W|PY21W|P21\/5W|T10|C5W)(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))/i,
    attributes: [
      { key: "base", label: "Цоколь", kind: "text", aliases: ["цоколь", "тип цоколя"], filter: true, summary: true },
      {
        key: "lampType", label: "Тип лампы", kind: "enum", aliases: ["тип лампы", "тип"], filter: true, summary: true,
        options: [opt("Светодиодная", /led|светодиод/i), opt("Ксеноновая", /ксенон|xenon|(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))d[1-4][sr](?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))/i), opt("Галогенная", /галоген|halogen/i), opt("Накаливания", /накалив/i)],
      },
      { key: "power", label: "Мощность", kind: "number", unit: "Вт", aliases: ["мощность", "мощность, вт"], filter: true, min: 1, max: 200 },
      { key: "voltage", label: "Напряжение", kind: "number", unit: "В", aliases: ["напряжение"], filter: true, min: 6, max: 24 },
      { key: "colorTemp", label: "Цветовая температура", kind: "number", unit: "К", aliases: ["цветовая температура"], filter: true, min: 2000, max: 10000 },
    ],
    extract(name) {
      const result: Record<string, string | number> = {}
      const base = name.match(/(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))(H(?:1|3|4|7|8|9|11|15|16|27)|HB[34]|HIR2|D[1-4][SR]|W5W|W21W|P21W|PY21W|P21\/5W|T10|C5W)(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))/i)
      if (base) result.base = base[1].toUpperCase()
      if (/led|светодиод/i.test(name)) result.lampType = "Светодиодная"
      else if (/ксенон|xenon/i.test(name) || /(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))D[1-4][SR](?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))/i.test(name)) result.lampType = "Ксеноновая"
      else if (/галоген|halogen/i.test(name) || /(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))H\d{1,2}(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))|HB[34]/i.test(name)) result.lampType = "Галогенная"
      put(result, "power", firstNumber(name, /(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))(\d{1,3})\s*(?:w|вт)(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))/i))
      put(result, "voltage", firstNumber(name, /(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))(12|24)\s*(?:v|в)(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))/i))
      put(result, "colorTemp", firstNumber(name, /(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))(\d{4})\s*k(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))/i))
      return result
    },
  },
  {
    key: "shock_absorbers", label: "Амортизаторы", department: "parts", partType: "SUSPENSION", subcategory: "Амортизаторы",
    detect: /амортизатор|shock\s+absorber|стойк\w*\s+амортиз/i,
    attributes: [
      AXLE,
      {
        key: "side", label: "Сторона", kind: "enum", aliases: ["сторона"], filter: true, summary: true,
        options: [opt("Левый", /лев|left|(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))lh(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))/i), opt("Правый", /прав|right|(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))rh(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))/i)],
      },
      {
        key: "shockType", label: "Тип", kind: "enum", aliases: ["тип", "тип амортизатора"], filter: true, summary: true,
        options: [opt("Газомасляный", /газомасл|газо-масл/i), opt("Газовый", /газ|gas/i), opt("Масляный", /масл|oil|hydraul/i)],
      },
    ],
    extract(name) {
      const result: Record<string, string | number> = {}
      if (/перед|front/i.test(name)) result.axle = "Передняя"
      else if (/зад|rear/i.test(name)) result.axle = "Задняя"
      if (/лев|(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))lh(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))/i.test(name)) result.side = "Левый"
      else if (/прав|(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))rh(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))/i.test(name)) result.side = "Правый"
      if (/газомасл|газо-масл/i.test(name)) result.shockType = "Газомасляный"
      else if (/газ(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))|газов|gas/i.test(name)) result.shockType = "Газовый"
      return result
    },
  },
  {
    key: "autochem", label: "Автохимия", department: "chemicals", partType: "CHEMICALS", subcategory: "Автохимия",
    detect: /очистител|полирол|присадк|герметик|автошампун|шампунь|смазк|(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))wd-?40(?:(?<![\wА-яЁё])(?=[\wА-яЁё])|(?<=[\wА-яЁё])(?![\wА-яЁё]))|антикор|преобразоват|раскоксов|кондиционер\s+(?:кож|пласт)|чернител|автохими/i,
    attributes: [
      VOLUME,
      {
        key: "purpose", label: "Назначение", kind: "enum", aliases: ["назначение", "применение"], filter: true, summary: true,
        options: [
          opt("Для двигателя", /двигат|мотор|раскоксов|промыв/i), opt("Для топливной системы", /топлив|инжектор|форсун/i),
          opt("Для кузова", /кузов|полирол|воск|шампун|антикор/i), opt("Для стёкол", /стекл|антидожд|антизапот/i),
          opt("Для салона", /салон|пласт|кож|ткан/i), opt("Для шин и дисков", /шин|диск|чернител/i), opt("Смазки", /смазк|wd-?40|литол/i),
        ],
      },
    ],
    extract(name) {
      const result: Record<string, string | number> = {}
      put(result, "volume", volumeLiters(name))
      return result
    },
  },
  {
    key: "tools", label: "Инструменты", department: "tools", partType: "TOOLS", subcategory: "Инструменты",
    detect: /домкрат|компрессор|набор\s+(?:ключей|инструм|головок)|ключ\w*\s+(?:баллон|динамомет|рожков|накидн)|пусков\w*\s+устройств|бустер|отв[её]ртк|съ[её]мник|инструмент/i,
    attributes: [],
  },
]

export const PRODUCT_GROUP_BY_KEY: ReadonlyMap<string, ProductGroup> = new Map(PRODUCT_GROUPS.map((group) => [group.key, group]))

export function productGroupsOfDepartment(department: DepartmentKey) {
  return PRODUCT_GROUPS.filter((group) => group.department === department)
}

/** Группа по подкатегории каталога: «Аккумулятор» → аккумуляторы. */
export function productGroupBySubcategory(subcategory: string | null | undefined) {
  if (!subcategory) return null
  return PRODUCT_GROUPS.find((group) => group.subcategory === subcategory) ?? null
}

/**
 * Узнаёт группу товара по названию и колонке «Категория».
 *
 * Порядок групп важен: трансмиссионное масло проверяется раньше
 * моторного, тормозная жидкость — раньше тормозных дисков. Ничего не
 * подошло — группы нет: выдуманная группа принесла бы выдуманные
 * характеристики.
 */
export function detectProductGroup(name: string, category?: string | null): ProductGroup | null {
  const haystack = `${category ?? ""} ${name}`
  const ordered = ["transmission_oil", "brake_fluid", "washer_fluid", "antifreeze", "engine_oil", "battery", "brake_discs", "brake_pads", "oil_filter", "air_filter", "cabin_filter", "fuel_filter", "spark_plugs", "wiper_blades", "shock_absorbers", "tires", "wheels", "bulbs", "autochem", "tools"]
  for (const key of ordered) {
    const group = PRODUCT_GROUP_BY_KEY.get(key)
    if (group?.detect.test(haystack)) return group
  }
  return null
}

const normalizeHeader = (value: string) => value.trim().toLocaleLowerCase("ru-RU").replace(/[«»"']/g, "").replace(/\s+/g, " ")

export type AttributeValue = { key: string; num: number | null; text: string | null }

/** Приводит одно значение к виду характеристики; негодное — null. */
export function normalizeAttributeValue(def: AttributeDef, raw: string | number): AttributeValue | null {
  if (def.kind === "number") {
    const value = typeof raw === "number" ? raw : Number(String(raw).replace(/\s+/g, "").replace(",", ".").replace(/[^\d.-]/g, ""))
    if (!Number.isFinite(value)) return null
    if ((def.min !== undefined && value < def.min) || (def.max !== undefined && value > def.max)) return null
    return { key: def.key, num: Math.round(value * 1000) / 1000, text: null }
  }
  const text = String(raw).trim().replace(/\s+/g, " ").slice(0, 80)
  if (!text) return null
  if (def.options) {
    const option = def.options.find((item) => item.value.toLowerCase() === text.toLowerCase() || item.match.test(text))
    return option ? { key: def.key, num: null, text: option.value } : null
  }
  return { key: def.key, num: null, text }
}

/**
 * Характеристики позиции: колонки прайса поверх разбора названия.
 * `columns` — заголовок колонки → значение из строки.
 */
export function readProductAttributes(group: ProductGroup, name: string, columns: Record<string, string> = {}): AttributeValue[] {
  const values = new Map<string, AttributeValue>()
  const extracted = group.extract?.(name) ?? {}
  for (const def of group.attributes) {
    const raw = extracted[def.key]
    if (raw === undefined) continue
    const value = normalizeAttributeValue(def, raw)
    if (value) values.set(def.key, value)
  }
  const headers = Object.keys(columns)
  for (const def of group.attributes) {
    const header = headers.find((item) => {
      const normalized = normalizeHeader(item)
      return normalized === normalizeHeader(def.label) || (def.aliases ?? []).some((alias) => normalized === alias)
    })
    if (!header || !columns[header]?.trim()) continue
    const value = normalizeAttributeValue(def, columns[header])
    if (value) values.set(def.key, value)
  }
  return Array.from(values.values())
}

/** Значение для показа: «62 Ач», «5W-30», «Обратная (+ справа)». */
export function formatAttributeValue(def: AttributeDef | undefined, value: { num: number | null; text: string | null }) {
  if (value.num !== null) {
    const number = value.num.toLocaleString("ru-RU", { maximumFractionDigits: 3 })
    return def?.unit ? (def.unit === "″" ? `${number}″` : `${number} ${def.unit}`) : number
  }
  return value.text ?? ""
}
