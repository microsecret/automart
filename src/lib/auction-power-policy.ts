/**
 * Отсев лотов по мощности — до перевода, а не после.
 *
 * Перевод описаний платный и медленный: каждый лот стоит запроса к
 * языковой модели. При этом машина мощнее порога льготного утильсбора
 * покупателю не нужна вовсе — сбор для неё вырастает в десятки раз и
 * съедает всю выгоду импорта. Такие лоты переводились и сохранялись
 * впустую, забивая и канал, и оплаченный лимит запросов.
 *
 * Поэтому решение принимается по мощности, которая известна из карточки
 * сразу, и только прошедшие отбор лоты идут на перевод.
 *
 * Отдельный модуль, потому что правило нужно и в разборе площадок, и в
 * импорте, и проверять его нужно без сети и базы.
 */

/* Пороги продублированы значениями, а не импортированы из
   utilization-fee: модуль проверяется тестовым раннером node, который не
   знает алиас @/. Значения закреплены тестами по обе стороны — расхождение
   поймается сразу. */

/** Порог льготного утильсбора для ДВС: 117,68 кВт. */
const PREFERENTIAL_POWER_LIMIT_HP = 160

/** Порог льготы для электромобилей и гибридов: 58,84 кВт. */
const PREFERENTIAL_ELECTRIC_POWER_LIMIT_HP = 80

export type PowerPolicyInput = {
  /** Мощность в лошадиных силах; null — неизвестна. */
  power?: number | null
  /** Тип топлива источника: электромобили и гибриды считаются иначе. */
  fuelType?: string | null
}

export type PowerPolicyVerdict = {
  /** Стоит ли тратить перевод и место в каталоге на этот лот. */
  eligible: boolean
  /** Порог, по которому принято решение. */
  limitHp: number
  /** Короткое объяснение для журнала сборщика. */
  reason: "ok" | "power_exceeds_limit" | "power_unknown"
}

/** Электромобили и гибриды: у них свой, более низкий порог льготы. */
function isElectricLike(fuelType: string | null | undefined): boolean {
  if (!fuelType) return false
  const normalized = fuelType.trim().toLowerCase()
  return /electric|hybrid|электр|гибрид|phev|hev|ev\b/.test(normalized)
}

/**
 * Проходит ли лот отбор по мощности.
 *
 * Неизвестная мощность пропускается: догадка здесь опаснее пропуска —
 * часть площадок (Encar, Carsensor, BE FORWARD, Goo-net) мощность не
 * публикует, и отбрасывать по её отсутствию значило бы потерять целые
 * источники.
 */
export function assessPowerPolicy(input: PowerPolicyInput): PowerPolicyVerdict {
  const limitHp = isElectricLike(input.fuelType)
    ? PREFERENTIAL_ELECTRIC_POWER_LIMIT_HP
    : PREFERENTIAL_POWER_LIMIT_HP

  const power = typeof input.power === "number" && Number.isFinite(input.power) ? input.power : null
  if (power === null || power <= 0) {
    return { eligible: true, limitHp, reason: "power_unknown" }
  }

  if (power > limitHp) {
    return { eligible: false, limitHp, reason: "power_exceeds_limit" }
  }

  return { eligible: true, limitHp, reason: "ok" }
}

/** Короткая проверка для мест, где подробности не нужны. */
export function passesPowerPolicy(input: PowerPolicyInput): boolean {
  return assessPowerPolicy(input).eligible
}
