/**
 * Расчёт утилизационного сбора для ввозимого автомобиля.
 *
 * Постановление Правительства РФ № 1291. Сумма считается как базовая ставка,
 * умноженная на коэффициент, а коэффициент зависит от трёх вещей: кто ввозит,
 * какая мощность и какой объём двигателя.
 *
 * Ключевой порог — 117,68 кВт (ровно 160 л.с.) для двигателей внутреннего
 * сгорания и 58,84 кВт (80 л.с.) для электромобилей и последовательных
 * гибридов. До порога физическое лицо, ввозящее машину для личного
 * пользования, платит фиксированную сумму; выше — коммерческий коэффициент,
 * который отличается в сотни раз: 5 200 ₽ против 1 363 000 ₽ на большом
 * объёме. Ошибка в определении мощности здесь дороже любой другой ошибки в
 * расчёте, поэтому неизвестная мощность не подменяется догадкой.
 */

/** Базовая ставка для легковых автомобилей категории M1. */
export const UTILIZATION_BASE_RATE_RUB = 20_000

/** Порог льготы для ДВС: 117,68 кВт. */
export const PREFERENTIAL_POWER_LIMIT_HP = 160

/** Порог льготы для электромобилей и гибридов: 58,84 кВт. */
export const PREFERENTIAL_ELECTRIC_POWER_LIMIT_HP = 80

/** Льготные коэффициенты физического лица для личного пользования. */
const PREFERENTIAL_COEFFICIENT_NEW = 0.17
const PREFERENTIAL_COEFFICIENT_USED = 0.26

/** Коммерческий коэффициент для электромобилей и гибридов свыше порога. */
const ELECTRIC_COMMERCIAL_COEFFICIENT = 15.73

/**
 * Коммерческие коэффициенты по объёму двигателя.
 *
 * Порядок важен: диапазоны проверяются сверху вниз, первый подходящий
 * выигрывает.
 */
const COMMERCIAL_COEFFICIENTS: ReadonlyArray<{ maxVolumeCc: number; coefficient: number }> = [
  { maxVolumeCc: 1_000, coefficient: 2.41 },
  { maxVolumeCc: 2_000, coefficient: 5.73 },
  { maxVolumeCc: 3_000, coefficient: 13.94 },
  { maxVolumeCc: 3_500, coefficient: 44.06 },
  { maxVolumeCc: Number.POSITIVE_INFINITY, coefficient: 68.15 },
]

const ELECTRIC_FUEL_TYPES = new Set(["ELECTRIC", "HYBRID"])

export type UtilizationFeeInput = {
  /** Мощность в лошадиных силах. Null — источник её не публикует. */
  power?: number | null
  /** Объём двигателя в кубических сантиметрах. */
  engineVolumeCc?: number | null
  fuelType?: string | null
  year: number
  manufacturedMonth?: string | null
}

export type UtilizationFeeResult = {
  /** Сумма сбора в рублях. Null — посчитать нечем. */
  feeRub: number | null
  /** Действует ли льготная ставка. */
  preferential: boolean
  /** Применённый коэффициент. */
  coefficient: number | null
  /** Порог мощности, действующий для этой машины. */
  powerLimitHp: number
  /** Машине больше трёх лет: коэффициент выше. */
  olderThanThreeYears: boolean
  /** Чего не хватило для точного расчёта. */
  missing: "power" | "engineVolume" | null
  /** Пояснение для карточки. */
  note: string
}

/**
 * Возраст считается от года выпуска, а при известном месяце — от него.
 * На границе трёх лет коэффициент растёт, поэтому месяц важен.
 */
function isOlderThanThreeYears(year: number, manufacturedMonth: string | null | undefined, now: Date) {
  const monthMatch = manufacturedMonth?.match(/^(\d{4})-(0[1-9]|1[0-2])$/)
  const releaseDate = monthMatch
    ? new Date(Number(monthMatch[1]), Number(monthMatch[2]) - 1, 1)
    : new Date(year, 0, 1)
  const threeYearsAgo = new Date(now.getFullYear() - 3, now.getMonth(), now.getDate())
  return releaseDate < threeYearsAgo
}

function commercialCoefficient(engineVolumeCc: number) {
  return COMMERCIAL_COEFFICIENTS.find((row) => engineVolumeCc <= row.maxVolumeCc)?.coefficient
    ?? COMMERCIAL_COEFFICIENTS[COMMERCIAL_COEFFICIENTS.length - 1].coefficient
}

/**
 * Считает утилизационный сбор для физического лица, ввозящего машину для
 * личного пользования.
 */
export function calculateUtilizationFee(input: UtilizationFeeInput, now = new Date()): UtilizationFeeResult {
  const isElectric = ELECTRIC_FUEL_TYPES.has(String(input.fuelType || "").toUpperCase())
  const powerLimitHp = isElectric ? PREFERENTIAL_ELECTRIC_POWER_LIMIT_HP : PREFERENTIAL_POWER_LIMIT_HP
  const olderThanThreeYears = isOlderThanThreeYears(input.year, input.manufacturedMonth, now)

  const power = typeof input.power === "number" && Number.isFinite(input.power) && input.power > 0
    ? input.power
    : null

  // Без мощности нельзя сказать, какая ставка применится: разница между
  // льготной и коммерческой доходит до сотен раз. Показывать одну из них
  // наугад значило бы ввести покупателя в заблуждение.
  if (power === null) {
    return {
      feeRub: null,
      preferential: false,
      coefficient: null,
      powerLimitHp,
      olderThanThreeYears,
      missing: "power",
      note: `Мощность не указана в источнике. До ${powerLimitHp} л.с. сбор составит ${olderThanThreeYears ? "5 200" : "3 400"} ₽, выше — рассчитывается по коммерческой ставке.`,
    }
  }

  if (power <= powerLimitHp) {
    const coefficient = olderThanThreeYears ? PREFERENTIAL_COEFFICIENT_USED : PREFERENTIAL_COEFFICIENT_NEW
    return {
      feeRub: Math.round(UTILIZATION_BASE_RATE_RUB * coefficient),
      preferential: true,
      coefficient,
      powerLimitHp,
      olderThanThreeYears,
      missing: null,
      note: `Льготная ставка: ${power} л.с. не превышает порога ${powerLimitHp} л.с.`,
    }
  }

  if (isElectric) {
    return {
      feeRub: Math.round(UTILIZATION_BASE_RATE_RUB * ELECTRIC_COMMERCIAL_COEFFICIENT),
      preferential: false,
      coefficient: ELECTRIC_COMMERCIAL_COEFFICIENT,
      powerLimitHp,
      olderThanThreeYears,
      missing: null,
      note: `Коммерческая ставка: ${power} л.с. выше порога ${powerLimitHp} л.с. для электромобилей и гибридов.`,
    }
  }

  const volume = typeof input.engineVolumeCc === "number" && Number.isFinite(input.engineVolumeCc) && input.engineVolumeCc > 0
    ? input.engineVolumeCc
    : null

  // Коммерческий коэффициент берётся по объёму двигателя, и разброс между
  // диапазонами двенадцатикратный. Без объёма сумму называть нельзя.
  if (volume === null) {
    return {
      feeRub: null,
      preferential: false,
      coefficient: null,
      powerLimitHp,
      olderThanThreeYears,
      missing: "engineVolume",
      note: `Мощность ${power} л.с. выше льготного порога, но объём двигателя неизвестен — коммерческая ставка зависит от него.`,
    }
  }

  const coefficient = commercialCoefficient(volume)
  return {
    feeRub: Math.round(UTILIZATION_BASE_RATE_RUB * coefficient),
    preferential: false,
    coefficient,
    powerLimitHp,
    olderThanThreeYears,
    missing: null,
    note: `Коммерческая ставка: ${power} л.с. выше порога ${powerLimitHp} л.с., объём ${volume} см³.`,
  }
}
