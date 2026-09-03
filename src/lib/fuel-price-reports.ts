// Открытые картографические данные содержат виды топлива, но не цены, а
// публичные API сетей АЗС требуют платного договора. Поэтому цена приходит от
// водителей. Одна отметка — это мнение, поэтому карта показывает согласованное
// значение: медиану свежих отметок с числом подтверждений, чтобы опечатка или
// одиночная выдумка не выглядели как факт.

// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { calculateConfidence, describeConfidence } from "./fuel-confidence.ts"

export const FUEL_REPORT_TYPES = ["AI92", "AI95", "AI98", "AI100", "DT", "GAS"] as const
export type FuelReportType = (typeof FUEL_REPORT_TYPES)[number]

export const FUEL_REPORT_LABELS: Readonly<Record<FuelReportType, string>> = {
  AI92: "АИ-92",
  AI95: "АИ-95",
  AI98: "АИ-98",
  AI100: "АИ-100",
  DT: "ДТ",
  GAS: "Газ",
}

// Цена хранится в копейках, поэтому дробное значение не теряется на округлении.
const MIN_PRICE_KOPECKS = 1_000 // 10 ₽ — ниже возможна только ошибка ввода
const MAX_PRICE_KOPECKS = 30_000 // 300 ₽ — выше любой реальной розницы
const FRESH_WINDOW_MS = 7 * 24 * 60 * 60 * 1_000
// Отметка, отличающаяся от согласованной цены больше чем на четверть, скорее
// всего содержит опечатку в разряде, а не отражает реальный разброс по сети.
const OUTLIER_RATIO = 0.25

export function isFuelReportType(value: unknown): value is FuelReportType {
  return typeof value === "string" && (FUEL_REPORT_TYPES as readonly string[]).includes(value)
}

/** Переводит цену из рублей в копейки хранилища.

    Через эту функцию проходят и то, что вводит человек в мини-приложении,
    и то, что отдают источники сбора. Раньше она понимала только чистое
    число: строка «58,90 ₽» превращалась в NaN и цена терялась молча —
    источник её прислал, а на карте оставалась пустота.

    Проверка на живых форматах показала, что шесть вариантов из
    одиннадцати не разбирались: с рублём, со словом «руб», с валютой
    впереди, с «RUB», с неразрывным пробелом внутри числа. У каждого
    источника своё оформление, и добавлять по замене на каждый случай
    значило бы возвращаться сюда после каждого нового поставщика.

    Поэтому берётся первое число в строке, а всё вокруг отбрасывается. */
export function parseReportedPrice(value: unknown) {
  if (typeof value === "number") return toKopecks(value)

  const text = String(value ?? "")
  if (!text.trim()) return null

  /* Разделители разрядов убираются до поиска числа: «1 234,50» это одна
     цена, а не «1» и «234,50». Пробел бывает обычным, неразрывным и
     узким — источники используют все три. */
  const cleaned = text.replace(/[\s   ](?=\d{3})/g, "")

  /* Число с дробной частью ищется первым.

     Строка вида «АИ-95: 58,90 ₽» встречается у источников, которые
     склеивают марку с ценой. Первое число в ней — 95 из названия марки,
     и без этого правила на карту попала бы цена 95 рублей вместо 58,90.
     Порог правдоподобия такую подмену не поймает: 95 рублей за литр
     выглядит возможной ценой.

     Настоящая цена почти всегда дробная — рубли с копейками. Целое число
     принимается только когда дробного в строке нет вовсе. */
  const withFraction = cleaned.match(/\d+[.,]\d+/)
  const whole = cleaned.match(/\d+/)
  const picked = withFraction?.[0] ?? whole?.[0]
  if (!picked) return null

  return toKopecks(Number(picked.replace(",", ".")))
}

function toKopecks(numeric: number) {
  if (!Number.isFinite(numeric)) return null
  const kopecks = Math.round(numeric * 100)
  if (kopecks < MIN_PRICE_KOPECKS || kopecks > MAX_PRICE_KOPECKS) return null
  return kopecks
}

export function formatReportedPrice(kopecks: number) {
  return (kopecks / 100).toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function median(values: number[]) {
  if (!values.length) return null
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? Math.round((sorted[middle - 1] + sorted[middle]) / 2) : sorted[middle]
}

export type FuelPriceReportRow = {
  fuel: string
  priceRub: number
  createdAt: Date
  /** Отметка вошедшего человека весит больше: анонимную накрутить проще. */
  userId?: string | null
}

export type ConsensusPrice = {
  fuel: FuelReportType
  label: string
  priceKopecks: number
  confirmations: number
  updatedAt: string
  /* Насколько крепкая цена: 0–100.
     Цена показывалась как факт, а за ней могла стоять одна отметка
     пятичасовой давности — человек ехал и платил на три рубля больше.
     Теми же правилами, что и наличие: свежесть, число отметок,
     согласие между ними. */
  confidencePercent: number
  confidenceLabel: "высокая" | "средняя" | "низкая"
  /** «2 метки за 3 ч» — из чего сложилось число. */
  confidenceNote: string
}

/**
 * Сводит отметки одной АЗС к согласованной цене по каждому виду топлива.
 *
 * Берутся только свежие отметки: устаревшая цена хуже отсутствующей, потому
 * что выглядит одинаково достоверно. Медиана устойчива к единичным выбросам,
 * а отметки, далеко ушедшие от неё, не учитываются в счётчике подтверждений.
 */
export function buildConsensusPrices(reports: FuelPriceReportRow[], now = new Date()): ConsensusPrice[] {
  const freshBoundary = now.getTime() - FRESH_WINDOW_MS
  const byFuel = new Map<FuelReportType, FuelPriceReportRow[]>()

  for (const report of reports) {
    if (!isFuelReportType(report.fuel)) continue
    if (report.createdAt.getTime() < freshBoundary) continue
    const bucket = byFuel.get(report.fuel)
    if (bucket) bucket.push(report)
    else byFuel.set(report.fuel, [report])
  }

  const consensus: ConsensusPrice[] = []
  for (const fuel of FUEL_REPORT_TYPES) {
    const bucket = byFuel.get(fuel)
    if (!bucket?.length) continue

    const consensusPrice = median(bucket.map((report) => report.priceRub))
    if (consensusPrice === null) continue

    const agreeing = bucket.filter((report) => Math.abs(report.priceRub - consensusPrice) <= consensusPrice * OUTLIER_RATIO)
    if (!agreeing.length) continue

    const latest = agreeing.reduce((newest, report) => (report.createdAt > newest ? report.createdAt : newest), agreeing[0].createdAt)
    /* Уверенность считается теми же правилами, что и у наличия:
       согласные с медианой идут как «да», разошедшиеся — как «нет».
       Пятеро, назвавшие одну цену, весят больше одного, а вчерашняя
       отметка — меньше получасовой. */
    const confidence = calculateConfidence(
      bucket.map((report) => ({
        state: Math.abs(report.priceRub - consensusPrice) <= consensusPrice * OUTLIER_RATIO ? "YES" as const : "NO" as const,
        createdAt: report.createdAt,
        authorized: Boolean(report.userId),
      })),
      now,
    )
    consensus.push({
      fuel,
      label: FUEL_REPORT_LABELS[fuel],
      priceKopecks: consensusPrice,
      confirmations: agreeing.length,
      updatedAt: latest.toISOString(),
      confidencePercent: confidence.percent,
      confidenceLabel: confidence.label,
      confidenceNote: describeConfidence(confidence),
    })
  }

  return consensus
}
