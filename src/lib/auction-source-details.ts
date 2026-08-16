import { isCustomerFacingRussianText } from "@/lib/auction-normalization"

export const AUCTION_SOURCE_MISSING_VALUE = "Не опубликовано источником"

export type AuctionSourceSpec = {
  label: string
  detail: string
  available: boolean
}

export type AuctionSourceDetailsInput = {
  sourceId?: string | null
  year: number
  manufacturedMonth?: string | null
  mileage?: number | null
  lotNumber?: string | null
  sourcePrice?: number | null
  sourceCurrency?: string | null
  engineVolume?: number | null
  power?: number | null
  fuelType?: string | null
  transmission?: string | null
  bodyType?: string | null
  driveType?: string | null
  color?: string | null
  vin?: string | null
  location?: string | null
  conditionInfo?: unknown
}

const FUEL_LABELS: Record<string, string> = {
  GASOLINE: "Бензин",
  DIESEL: "Дизель",
  ELECTRIC: "Электро",
  HYBRID: "Гибрид",
  GAS: "Газ",
  OTHER: "Другое",
}

const TRANSMISSION_LABELS: Record<string, string> = {
  MANUAL: "Механика",
  AUTOMATIC: "Автомат",
  VARIATOR: "Вариатор",
  ROBOTIC: "Роботизированная",
}

const BODY_LABELS: Record<string, string> = {
  SEDAN: "Седан",
  HATCHBACK: "Хэтчбек",
  SUV: "Кроссовер / внедорожник",
  COUPE: "Купе",
  CONVERTIBLE: "Кабриолет",
  WAGON: "Универсал",
  MINIVAN: "Минивэн",
  PICKUP: "Пикап",
  OTHER: "Другой",
}

const DRIVE_LABELS: Record<string, string> = {
  FWD: "Передний",
  RWD: "Задний",
  AWD: "Полный",
  FOUR_WHEEL_DRIVE: "Полный",
}

const CANONICAL_FIELDS = [
  { label: "Год выпуска", aliases: ["год", "год выпуска", "модельный год", "выпуск"] },
  { label: "Пробег", aliases: ["пробег", "показания одометра"] },
  { label: "Номер лота", aliases: ["номер лота", "лот", "референсный номер", "номер объявления"] },
  { label: "Ориентир цены источника", aliases: ["ориентир цены источника", "цена источника", "ориентировочная цена источника"] },
  { label: "Стартовая ставка", aliases: ["стартовая ставка", "начальная ставка", "стартовая цена"] },
  { label: "База предварительного расчёта", aliases: ["база предварительного расчёта", "расчётная цена", "база расчёта"] },
  { label: "Объём двигателя", aliases: ["объём двигателя", "объем двигателя", "объём", "рабочий объём"] },
  { label: "Мощность ДВС", aliases: ["мощность двс", "мощность", "мощность двигателя"] },
  { label: "Количество ключей", aliases: ["количество ключей", "ключи", "ключей"] },
  { label: "Количество мест", aliases: ["количество мест", "мест", "посадочных мест"] },
  { label: "Экологический стандарт", aliases: ["экологический стандарт", "экокласс", "экологический класс"] },
  { label: "Местонахождение", aliases: ["местонахождение", "локация", "место хранения", "адрес площадки"] },
  { label: "Серьёзные дефекты отчёта", aliases: ["серьёзные дефекты отчёта", "серьезные дефекты отчета", "серьёзные дефекты", "серьезные дефекты"] },
  { label: "Замечания осмотра", aliases: ["замечания осмотра", "дефекты", "замечания", "результат осмотра"] },
] as const

const SOURCE_PREFERRED_FIELDS = new Set<string>([
  "Ориентир цены источника",
  "Стартовая ставка",
  "Количество ключей",
  "Количество мест",
  "Экологический стандарт",
  "Серьёзные дефекты отчёта",
  "Замечания осмотра",
])

function normalizeLabel(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase("ru-RU").replace(/ё/g, "е").replace(/[^a-zа-я0-9]+/g, " ").trim()
}

function canonicalLabel(value: string) {
  const normalized = normalizeLabel(value)
  return CANONICAL_FIELDS.find((field) => field.aliases.some((alias) => normalizeLabel(alias) === normalized))?.label || null
}

export function parseAuctionSourceSpecs(value: string | null | undefined): AuctionSourceSpec[] {
  if (!value || !isCustomerFacingRussianText(value)) return []
  return value.split(/[;\n]+/).flatMap((entry) => {
    const separator = entry.indexOf(":")
    if (separator <= 0) return []
    const label = entry.slice(0, separator).trim()
    const detail = entry.slice(separator + 1).trim()
    if (!label || !detail || label.length > 80 || detail.length > 240 || !isCustomerFacingRussianText(`${label}: ${detail}`)) return []
    return [{ label, detail, available: detail !== AUCTION_SOURCE_MISSING_VALUE }]
  }).slice(0, 40)
}

function parseConditionInfo(value: unknown) {
  if (!value) return null
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value
    return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : null
  } catch {
    return null
  }
}

function inspectionSummary(value: unknown) {
  const condition = parseConditionInfo(value)
  if (!condition) return { notes: null as string | null, serious: null as string | null }
  const report = condition.damageReport && typeof condition.damageReport === "object"
    ? condition.damageReport as { sections?: unknown }
    : null
  const sections = Array.isArray(report?.sections) ? report.sections : []
  let items = 0
  let serious = 0
  for (const sectionValue of sections) {
    if (!sectionValue || typeof sectionValue !== "object") continue
    const sectionItems = Array.isArray((sectionValue as { items?: unknown }).items) ? (sectionValue as { items: unknown[] }).items : []
    for (const itemValue of sectionItems) {
      if (!itemValue || typeof itemValue !== "object") continue
      items += 1
      const kinds = (itemValue as { kinds?: unknown }).kinds
      if (Array.isArray(kinds) && kinds.includes("SERIOUS")) serious += 1
    }
  }
  const verifiedItems = Array.isArray(condition.verifiedItems) ? condition.verifiedItems : []
  const publishedInspection = isCustomerFacingRussianText(condition.inspectionSummary) ? condition.inspectionSummary.trim() : null
  return {
    notes: items > 0 ? `${items}` : publishedInspection || (verifiedItems.length > 0 ? `Опубликовано пунктов проверки: ${verifiedItems.length}` : null),
    serious: serious > 0 ? `Выявлено: ${serious}` : sections.length > 0 ? "не выявлены" : null,
  }
}

function sourcePrice(amount: number | null | undefined, currency: string | null | undefined) {
  if (!amount || !Number.isFinite(amount) || !currency) return null
  return `${Math.round(amount).toLocaleString("ru-RU")} ${currency}`
}

function knownValue(value: string | null | undefined, labels: Record<string, string>) {
  return value ? labels[value] || value : null
}

export function buildAuctionSourceSpecs(input: AuctionSourceDetailsInput, sourceValue?: string | null): AuctionSourceSpec[] {
  const sourceRows = parseAuctionSourceSpecs(sourceValue)
  const sourceByCanonical = new Map<string, AuctionSourceSpec>()
  for (const row of sourceRows) {
    const canonical = canonicalLabel(row.label)
    if (canonical && !sourceByCanonical.has(canonical)) sourceByCanonical.set(canonical, row)
  }

  const condition = inspectionSummary(input.conditionInfo)
  const calculated: Record<(typeof CANONICAL_FIELDS)[number]["label"], string | null> = {
    "Год выпуска": String(input.year),
    "Пробег": input.mileage == null ? null : `${Math.round(input.mileage).toLocaleString("ru-RU")} км`,
    "Номер лота": input.lotNumber?.trim() || input.sourceId?.trim() || null,
    "Ориентир цены источника": sourcePrice(input.sourcePrice, input.sourceCurrency),
    "Стартовая ставка": null,
    "База предварительного расчёта": sourcePrice(input.sourcePrice, input.sourceCurrency),
    "Объём двигателя": input.engineVolume == null ? null : `${Math.round(input.engineVolume).toLocaleString("ru-RU")} см³`,
    "Мощность ДВС": input.power == null ? null : `${Math.round(input.power).toLocaleString("ru-RU")} л.с.`,
    "Количество ключей": null,
    "Количество мест": null,
    "Экологический стандарт": null,
    "Местонахождение": input.location?.trim() || null,
    "Серьёзные дефекты отчёта": condition.serious,
    "Замечания осмотра": condition.notes,
  }

  const unifiedRows = CANONICAL_FIELDS.map((field) => {
    const source = sourceByCanonical.get(field.label)
    const sourceDetail = source?.available ? source.detail : null
    const detail = (SOURCE_PREFERRED_FIELDS.has(field.label)
      ? sourceDetail || calculated[field.label]
      : calculated[field.label] || sourceDetail) || AUCTION_SOURCE_MISSING_VALUE
    return { label: field.label, detail, available: detail !== AUCTION_SOURCE_MISSING_VALUE }
  })

  const consumedLabels = new Set(sourceRows.flatMap((row) => canonicalLabel(row.label) ? [normalizeLabel(row.label)] : []))
  const extraRows: AuctionSourceSpec[] = [
    input.manufacturedMonth ? { label: "Месяц выпуска", detail: input.manufacturedMonth, available: true } : null,
    input.fuelType ? { label: "Тип топлива", detail: knownValue(input.fuelType, FUEL_LABELS)!, available: true } : null,
    input.transmission ? { label: "Коробка передач", detail: knownValue(input.transmission, TRANSMISSION_LABELS)!, available: true } : null,
    input.bodyType ? { label: "Кузов", detail: knownValue(input.bodyType, BODY_LABELS)!, available: true } : null,
    input.driveType ? { label: "Привод", detail: knownValue(input.driveType, DRIVE_LABELS)!, available: true } : null,
    input.color ? { label: "Цвет", detail: input.color, available: true } : null,
    input.vin ? { label: "VIN / номер кузова", detail: input.vin, available: true } : null,
    ...sourceRows.filter((row) => !canonicalLabel(row.label) && !consumedLabels.has(normalizeLabel(row.label))),
  ].filter((row): row is AuctionSourceSpec => Boolean(row))

  const seen = new Set(unifiedRows.map((row) => normalizeLabel(row.label)))
  return [...unifiedRows, ...extraRows.filter((row) => {
    const key = normalizeLabel(row.label)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })].slice(0, 36)
}

export function serializeAuctionSourceSpecs(input: AuctionSourceDetailsInput, sourceValue?: string | null) {
  return buildAuctionSourceSpecs(input, sourceValue).map((row) => `${row.label}: ${row.detail}`).join("\n")
}
