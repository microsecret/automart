// Разбор прайс-листа магазина. Продавец выгружает файл из своей системы, и
// формат почти никогда не совпадает с ожидаемым: другой порядок колонок,
// точка с запятой вместо запятой, цена с пробелами и знаком рубля.
//
// Поэтому импорт не отвергает файл целиком: он принимает годные строки,
// объясняет каждую отклонённую и показывает результат до записи в каталог.

export const PART_IMPORT_COLUMNS = [
  { key: "name", label: "Название", required: true, aliases: ["наименование", "товар", "деталь", "name", "title"] },
  { key: "price", label: "Цена", required: true, aliases: ["стоимость", "цена, руб", "price", "cost"] },
  { key: "oemNumber", label: "OEM-номер", required: false, aliases: ["оем", "артикул", "номер", "код", "oem", "sku", "article"] },
  { key: "crossNumbers", label: "Аналоги", required: false, aliases: ["кросс", "кросс-номера", "заменители", "аналог", "cross", "replaces"] },
  { key: "brandName", label: "Производитель", required: false, aliases: ["бренд", "марка детали", "изготовитель", "brand", "manufacturer"] },
  { key: "make", label: "Марка авто", required: false, aliases: ["марка", "марка автомобиля", "make"] },
  { key: "model", label: "Модель авто", required: false, aliases: ["модель", "модель автомобиля", "model"] },
  { key: "partType", label: "Категория", required: false, aliases: ["тип", "раздел", "категория", "type", "category"] },
  { key: "condition", label: "Состояние", required: false, aliases: ["новая", "состояние детали", "condition"] },
  { key: "quantity", label: "Количество", required: false, aliases: ["кол-во", "остаток", "наличие", "qty", "stock"] },
  { key: "leadTime", label: "Срок поставки", required: false, aliases: ["срок", "доставка", "дни", "lead time"] },
  { key: "description", label: "Описание", required: false, aliases: ["примечание", "комментарий", "description", "note"] },
] as const

export type PartImportColumnKey = (typeof PART_IMPORT_COLUMNS)[number]["key"]

export type PartImportRow = {
  line: number
  name: string
  price: number
  oemNumber: string | null
  crossNumbers: string[]
  brandName: string | null
  make: string | null
  model: string | null
  partType: string
  condition: "NEW" | "USED"
  supplyMode: "STOCK" | "ORDER"
  leadTimeDaysMin: number | null
  leadTimeDaysMax: number | null
  description: string | null
}

export type PartImportError = {
  line: number
  reason: string
  raw: string
}

export type PartImportResult = {
  columns: Partial<Record<PartImportColumnKey, number>>
  rows: PartImportRow[]
  errors: PartImportError[]
  totalRows: number
}

const PART_TYPE_ALIASES: Readonly<Record<string, string>> = {
  двигатель: "ENGINE", моторные: "ENGINE", мотор: "ENGINE", engine: "ENGINE",
  трансмиссия: "TRANSMISSION", кпп: "TRANSMISSION", коробка: "TRANSMISSION", transmission: "TRANSMISSION",
  подвеска: "SUSPENSION", ходовая: "SUSPENSION", suspension: "SUSPENSION",
  тормоза: "BRAKES", тормозная: "BRAKES", brakes: "BRAKES",
  электрика: "ELECTRICAL", электрооборудование: "ELECTRICAL", electrical: "ELECTRICAL",
  кузов: "BODY", кузовные: "BODY", body: "BODY",
  салон: "INTERIOR", интерьер: "INTERIOR", interior: "INTERIOR",
  колеса: "WHEELS", диски: "WHEELS", шины: "WHEELS", wheels: "WHEELS",
  оптика: "LIGHTING", фары: "LIGHTING", свет: "LIGHTING", lighting: "LIGHTING",
  охлаждение: "COOLING", радиатор: "COOLING", cooling: "COOLING",
  выхлоп: "EXHAUST", глушитель: "EXHAUST", exhaust: "EXHAUST",
  рулевое: "STEERING", руль: "STEERING", steering: "STEERING",
  аксессуары: "ACCESSORIES", accessories: "ACCESSORIES",
  расходники: "CONSUMABLES", consumables: "CONSUMABLES",
}

function normalizeHeader(value: string) {
  return value.trim().toLocaleLowerCase("ru-RU").replace(/[«»"']/g, "").replace(/\s+/g, " ")
}

/** Определяет разделитель по первой строке: сравнивать надо вне кавычек. */
export function detectDelimiter(headerLine: string) {
  const candidates = [";", ",", "\t"]
  let best = ";"
  let bestCount = -1
  for (const candidate of candidates) {
    let count = 0
    let quoted = false
    for (const char of headerLine) {
      if (char === '"') quoted = !quoted
      else if (char === candidate && !quoted) count += 1
    }
    if (count > bestCount) {
      bestCount = count
      best = candidate
    }
  }
  return best
}

/** Разбирает строку CSV с учётом кавычек и удвоенных кавычек внутри поля. */
export function parseCsvLine(line: string, delimiter: string) {
  const cells: string[] = []
  let current = ""
  let quoted = false

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"'
        index += 1
      } else {
        quoted = !quoted
      }
      continue
    }
    if (char === delimiter && !quoted) {
      cells.push(current.trim())
      current = ""
      continue
    }
    current += char
  }
  cells.push(current.trim())
  return cells
}

/**
 * Цена приходит в самых разных видах: «12 500,50 ₽», «12500.5», «12'500».
 * Разделитель дробной части определяется по позиции, а не по символу: в
 * «1,234.56» запятая разделяет разряды, а в «1.234,56» — наоборот.
 */
export function parsePrice(value: string) {
  const cleaned = value.replace(/[^\d.,-]/g, "").trim()
  if (!cleaned) return null

  const lastComma = cleaned.lastIndexOf(",")
  const lastDot = cleaned.lastIndexOf(".")
  let normalized = cleaned

  if (lastComma >= 0 && lastDot >= 0) {
    // Дробную часть отделяет тот символ, который стоит правее.
    normalized = lastComma > lastDot
      ? cleaned.replace(/\./g, "").replace(",", ".")
      : cleaned.replace(/,/g, "")
  } else if (lastComma >= 0) {
    // Запятая с тремя цифрами после неё — разделитель разрядов, а не дроби.
    normalized = cleaned.length - lastComma === 4 ? cleaned.replace(/,/g, "") : cleaned.replace(",", ".")
  }

  const parsed = Number(normalized)
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return Math.round(parsed)
}

function parseLeadTime(value: string | undefined) {
  if (!value) return { min: null as number | null, max: null as number | null }
  const numbers = value.match(/\d+/g)?.map(Number).filter((n) => Number.isFinite(n) && n >= 0 && n <= 365) || []
  if (!numbers.length) return { min: null, max: null }
  const min = Math.min(...numbers)
  const max = Math.max(...numbers)
  return { min, max }
}

/**
 * Приводит артикул к виду, по которому его можно найти.
 *
 * Один и тот же номер печатают как «GDB-1330», «GDB 1330» и «gdb1330»:
 * покупатель вводит любой из вариантов и должен попасть в ту же позицию.
 */
export function normalizeOemNumber(value: string) {
  return value.toLocaleUpperCase("en-US").replace(/[^A-Z0-9А-ЯЁ]/gu, "")
}

// Аналоги перечисляют через запятую, точку с запятой или перенос строки —
// зависит от того, из какой системы выгружен прайс.
const CROSS_SEPARATOR = /[,;/|\n]+/

function parseCrossNumbers(value: string | undefined, ownNumber: string | null) {
  if (!value) return []
  const own = ownNumber ? normalizeOemNumber(ownNumber) : null
  const seen = new Set<string>()
  const numbers: string[] = []

  for (const rawNumber of value.split(CROSS_SEPARATOR)) {
    const trimmed = rawNumber.trim().slice(0, 64)
    if (!trimmed) continue
    const normalized = normalizeOemNumber(trimmed)
    // Слишком короткий фрагмент — обычно мусор разбора, а не артикул.
    if (normalized.length < 3) continue
    // Собственный артикул в списке аналогов бесполезен и создаёт дубль связи.
    if (own && normalized === own) continue
    if (seen.has(normalized)) continue
    seen.add(normalized)
    numbers.push(trimmed)
    if (numbers.length >= 20) break
  }

  return numbers
}

function detectCondition(value: string | undefined) {
  if (!value) return "NEW" as const
  return /б\/?у|used|разбор|contract/i.test(value) ? ("USED" as const) : ("NEW" as const)
}

function detectPartType(value: string | undefined) {
  if (!value) return "OTHER"
  const normalized = normalizeHeader(value)
  for (const [alias, type] of Object.entries(PART_TYPE_ALIASES)) {
    if (normalized.includes(alias)) return type
  }
  return "OTHER"
}

/** Сопоставляет колонки файла с полями каталога по названию заголовка. */
export function matchColumns(headerCells: string[]) {
  const columns: Partial<Record<PartImportColumnKey, number>> = {}
  headerCells.forEach((cell, index) => {
    const normalized = normalizeHeader(cell)
    if (!normalized) return
    for (const column of PART_IMPORT_COLUMNS) {
      if (columns[column.key] !== undefined) continue
      const matches = normalized === normalizeHeader(column.label)
        || column.aliases.some((alias) => normalized === alias || normalized.includes(alias))
      if (matches) {
        columns[column.key] = index
        return
      }
    }
  })
  return columns
}

/**
 * Разбирает файл прайс-листа.
 *
 * Возвращает и годные строки, и причины отказа: продавец должен видеть, что
 * именно не так с его файлом, до того как позиции попадут в каталог.
 */
export function parsePartImportFile(content: string, options: { maxRows?: number } = {}): PartImportResult {
  const maxRows = options.maxRows ?? 5_000
  // BOM ломает сопоставление первой колонки, если файл выгружен из Excel.
  const lines = content.replace(/^﻿/, "").split(/\r?\n/).filter((line) => line.trim().length > 0)
  if (!lines.length) {
    return { columns: {}, rows: [], errors: [{ line: 0, reason: "Файл пуст", raw: "" }], totalRows: 0 }
  }

  const delimiter = detectDelimiter(lines[0])
  const columns = matchColumns(parseCsvLine(lines[0], delimiter))

  const missing = PART_IMPORT_COLUMNS.filter((column) => column.required && columns[column.key] === undefined)
  if (missing.length) {
    return {
      columns,
      rows: [],
      errors: [{
        line: 1,
        reason: `В заголовке не найдены обязательные колонки: ${missing.map((column) => column.label).join(", ")}`,
        raw: lines[0].slice(0, 200),
      }],
      totalRows: 0,
    }
  }

  const rows: PartImportRow[] = []
  const errors: PartImportError[] = []
  const seenKeys = new Set<string>()

  for (let index = 1; index < lines.length && rows.length < maxRows; index += 1) {
    const line = lines[index]
    const cells = parseCsvLine(line, delimiter)
    const readCell = (key: PartImportColumnKey) => {
      const position = columns[key]
      return position === undefined ? undefined : cells[position]?.trim() || undefined
    }

    const name = readCell("name")
    if (!name) {
      errors.push({ line: index + 1, reason: "Пустое название позиции", raw: line.slice(0, 160) })
      continue
    }

    const price = parsePrice(readCell("price") || "")
    if (price === null) {
      errors.push({ line: index + 1, reason: "Цена не распознана или равна нулю", raw: line.slice(0, 160) })
      continue
    }
    if (price > 100_000_000) {
      errors.push({ line: index + 1, reason: "Цена выходит за допустимый диапазон", raw: line.slice(0, 160) })
      continue
    }

    const oemNumber = readCell("oemNumber")?.toLocaleUpperCase("en-US").replace(/\s+/g, "") || null
    // Один и тот же артикул в файле обычно означает случайный дубль строки:
    // публиковать обе позиции значит замусорить витрину.
    const dedupeKey = `${oemNumber || name.toLocaleLowerCase("ru-RU")}|${price}`
    if (seenKeys.has(dedupeKey)) {
      errors.push({ line: index + 1, reason: "Дубль строки в файле", raw: line.slice(0, 160) })
      continue
    }
    seenKeys.add(dedupeKey)

    const quantityRaw = readCell("quantity")
    const quantity = quantityRaw ? Number(quantityRaw.replace(/[^\d-]/g, "")) : null
    const leadTime = parseLeadTime(readCell("leadTime"))
    // Нулевой остаток при указанном сроке — это позиция под заказ, а не
    // отсутствие товара: скрывать её из каталога неправильно.
    const supplyMode = (quantity !== null && Number.isFinite(quantity) && quantity > 0) ? "STOCK" as const : "ORDER" as const

    rows.push({
      line: index + 1,
      name: name.slice(0, 200),
      price,
      oemNumber: oemNumber?.slice(0, 64) || null,
      crossNumbers: parseCrossNumbers(readCell("crossNumbers"), oemNumber || null),
      brandName: readCell("brandName")?.slice(0, 80) || null,
      make: readCell("make")?.slice(0, 60) || null,
      model: readCell("model")?.slice(0, 60) || null,
      partType: detectPartType(readCell("partType")),
      condition: detectCondition(readCell("condition")),
      supplyMode,
      leadTimeDaysMin: leadTime.min,
      leadTimeDaysMax: leadTime.max,
      description: readCell("description")?.slice(0, 1_000) || null,
    })
  }

  const skippedByLimit = Math.max(0, lines.length - 1 - rows.length - errors.length)
  if (skippedByLimit > 0) {
    errors.push({
      line: 0,
      reason: `Файл длиннее лимита: не обработано ${skippedByLimit} строк. Разделите прайс на части.`,
      raw: "",
    })
  }

  return { columns, rows, errors, totalRows: lines.length - 1 }
}
