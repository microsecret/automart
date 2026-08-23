// Значение совпадает с `MAX_AUCTION_INTEGER` из `auction-price-guard`. Оно
// продублировано намеренно: модуль остаётся без внутренних импортов, поэтому
// его правила проверяются тестами без сборки и path-alias.
const MAX_AUCTION_INTEGER = 2_147_483_647

// Публикацию лота нельзя доверять источнику полностью: витрины отдают
// промо-цены «от», тестовые записи и карточки без фотографий. Такой лот в
// каталоге выглядит как реальное предложение и обесценивает выдачу, поэтому
// импорт скрывает его до следующего обновления источника вместо удаления.

export const QUALITY_HOLD_PREFIX = "Автопроверка качества"

const MIN_TRUSTWORTHY_SOURCE_PRICE = 100
const MIN_PLAUSIBLE_YEAR = 1950
const MAX_PLAUSIBLE_MILEAGE_KM = 1_500_000
const MAX_PLAUSIBLE_ENGINE_VOLUME_CC = 12_000
const MAX_PLAUSIBLE_POWER_HP = 2_000
// Порог намеренно мягкий: он должен ловить перепутанные единицы и мили, а не
// спорить с редким, но настоящим коммерческим пробегом.
const IMPLAUSIBLE_NEW_CAR_MILEAGE_KM = 200_000
const IMPLAUSIBLE_OLD_CAR_MILEAGE_KM = 1_000
const ELECTRIC_FUEL_TYPES = new Set(["ELECTRIC", "ELECTRICITY", "EV", "ЭЛЕКТРО"])

export type AuctionQualityInput = {
  sourceTitle?: string | null
  make: string | null
  model: string | null
  year: number | null
  manufacturedMonth?: string | null
  mileage: number | null
  sourcePrice: number
  engineVolume: number | null
  power: number | null
  fuelType?: string | null
  imageUrl: string | null
  images: string[] | null
}

function explicitSourceTitleYears(value: string | null | undefined, currentYear: number) {
  if (!value?.trim()) return []
  const years = new Set<number>()

  for (const match of value.normalize("NFKC").matchAll(/(?:^|\D)((?:19|20)\d{2})(?!\d)/g)) {
    years.add(Number(match[1]))
  }

  // Корейские и русские каталоги часто сокращают год до «23년» или
  // «23 г.в.». Самостоятельные двузначные числа не трогаем: это может быть
  // мощность, индекс модели или объём двигателя.
  for (const match of value.normalize("NFKC").matchAll(/(?:^|\D)(\d{2})\s*(?:년|年式|г\.?\s*в\.?|год(?:а)?|model\s*year|MY)(?!\p{L})/giu)) {
    const shortYear = Number(match[1])
    const currentCenturyYear = 2000 + shortYear
    years.add(currentCenturyYear <= currentYear + 1 ? currentCenturyYear : 1900 + shortYear)
  }

  return [...years]
}

export type AuctionQualityAssessment = {
  anomalies: string[]
}

export type AuctionQualityModerationUpdate = {
  status: "ACTIVE" | "POLICY_EXCLUDED"
  adminHiddenAt: Date | null
  adminHiddenReason: string | null
  transition: "HELD" | "RESTORED" | "UNCHANGED"
}

function hasUsableImage(input: AuctionQualityInput) {
  const gallery = Array.isArray(input.images) ? input.images : []
  const candidates = [input.imageUrl, ...gallery]
  return candidates.some((value) => typeof value === "string" && /^https:\/\/\S+/i.test(value.trim()))
}

function isMeaningfulIdentity(value: string | null) {
  if (!value) return false
  const normalized = value.trim()
  if (normalized.length < 2) return false
  // Источник иногда отдаёт заглушки вместо марки или модели.
  return !/^(n\/?a|none|null|undefined|unknown|test|0+|-+)$/i.test(normalized)
}

/**
 * Проверяет один импортируемый лот на аномалии, из-за которых карточку нельзя
 * показывать покупателю. Функция чистая: она только описывает найденные
 * проблемы, а решение о скрытии принимает импорт.
 */
export function evaluateAuctionImportItemQuality(input: AuctionQualityInput): AuctionQualityAssessment {
  const anomalies: string[] = []
  const currentYear = new Date().getFullYear()

  if (!isMeaningfulIdentity(input.make) || !isMeaningfulIdentity(input.model)) {
    anomalies.push("не распознаны марка и модель")
  }

  if (!Number.isFinite(input.sourcePrice) || input.sourcePrice < MIN_TRUSTWORTHY_SOURCE_PRICE) {
    // Витрины публикуют «1» или «0» для лотов с ценой по запросу.
    anomalies.push("цена источника недостоверна")
  } else if (input.sourcePrice > MAX_AUCTION_INTEGER) {
    anomalies.push("цена источника выходит за допустимый диапазон")
  }

  if (input.year != null && (input.year < MIN_PLAUSIBLE_YEAR || input.year > currentYear + 1)) {
    anomalies.push("год выпуска вне допустимого диапазона")
  }

  const sourceTitleYears = explicitSourceTitleYears(input.sourceTitle, currentYear)
  if (input.year != null && sourceTitleYears.length > 0 && !sourceTitleYears.includes(input.year)) {
    anomalies.push("год выпуска не совпадает с названием источника")
  }

  const manufacturedYear = input.manufacturedMonth?.match(/^(19|20)\d{2}-(0[1-9]|1[0-2])$/)?.[0].slice(0, 4)
  if (input.year != null && manufacturedYear && Number(manufacturedYear) !== input.year) {
    anomalies.push("год выпуска не совпадает с датой производства")
  }

  if (input.mileage != null && (input.mileage < 0 || input.mileage > MAX_PLAUSIBLE_MILEAGE_KM)) {
    anomalies.push("пробег вне допустимого диапазона")
  }

  if (input.engineVolume != null && (input.engineVolume < 0 || input.engineVolume > MAX_PLAUSIBLE_ENGINE_VOLUME_CC)) {
    anomalies.push("объём двигателя вне допустимого диапазона")
  }

  if (input.power != null && (input.power < 0 || input.power > MAX_PLAUSIBLE_POWER_HP)) {
    anomalies.push("мощность вне допустимого диапазона")
  }

  if (!hasUsableImage(input)) {
    anomalies.push("нет ни одной пригодной фотографии")
  }

  // Противоречия между полями. Каждое из значений по отдельности выглядит
  // допустимым, поэтому диапазонные проверки выше их не ловят, а покупатель
  // видит карточку, которая сама себе противоречит.
  if (input.year != null && input.mileage != null) {
    const age = Math.max(0, currentYear - input.year)
    if (age <= 1 && input.mileage > IMPLAUSIBLE_NEW_CAR_MILEAGE_KM) {
      anomalies.push("пробег не соответствует году выпуска")
    }
    if (age >= 5 && input.mileage > 0 && input.mileage < IMPLAUSIBLE_OLD_CAR_MILEAGE_KM) {
      anomalies.push("пробег не соответствует возрасту автомобиля")
    }
  }

  const fuel = input.fuelType?.trim().toUpperCase() || null
  if (fuel && ELECTRIC_FUEL_TYPES.has(fuel) && input.engineVolume != null && input.engineVolume > 0) {
    anomalies.push("у электромобиля указан объём двигателя внутреннего сгорания")
  }

  return { anomalies }
}

/** Формирует причину скрытия, понятную администратору в реестре лотов. */
export function createQualityHoldReason(anomalies: string[]) {
  const details = anomalies.filter(Boolean).join("; ")
  return details ? `${QUALITY_HOLD_PREFIX}: ${details}` : QUALITY_HOLD_PREFIX
}

/**
 * Отличает автоматическое скрытие от ручного решения администратора.
 * Импорт снимает только собственный hold: ручное скрытие остаётся в силе.
 */
export function isQualityHoldReason(reason: string | null | undefined) {
  return typeof reason === "string" && reason.startsWith(QUALITY_HOLD_PREFIX)
}

/**
 * Возвращает единое состояние модерации после автопроверки. Ручное скрытие
 * администратора имеет приоритет: импорт не меняет ни его причину, ни статус.
 */
export function auctionQualityModerationUpdate(input: {
  adminHiddenAt: Date | null
  adminHiddenReason: string | null
  anomalies: string[]
  now?: Date
}): AuctionQualityModerationUpdate | null {
  const wasQualityHeld = isQualityHoldReason(input.adminHiddenReason)
  const isManuallyHidden = Boolean(input.adminHiddenAt && !wasQualityHeld)
  if (isManuallyHidden) return null

  if (input.anomalies.length > 0) {
    return {
      status: "POLICY_EXCLUDED",
      adminHiddenAt: input.adminHiddenAt || input.now || new Date(),
      adminHiddenReason: createQualityHoldReason(input.anomalies),
      transition: wasQualityHeld ? "UNCHANGED" : "HELD",
    }
  }

  return {
    status: "ACTIVE",
    adminHiddenAt: null,
    adminHiddenReason: null,
    transition: wasQualityHeld ? "RESTORED" : "UNCHANGED",
  }
}
