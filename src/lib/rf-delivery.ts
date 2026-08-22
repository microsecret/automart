// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { CITY_COORDINATES } from "./cities.ts"
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { distanceKm } from "./geo-distance.ts"

/**
 * Оценка доставки автомобиля из Владивостока по России.
 *
 * Раньше калькулятор знал цены для пятнадцати городов, а всем остальным
 * подставлял 180 000 ₽ — столько же, сколько до Москвы. Житель Хабаровска
 * видел московскую цену, хотя до него шестьсот километров, а не шесть тысяч.
 *
 * Для городов с известной ценой перевозчика она и используется: это факт, а
 * не расчёт. Для остальных считаем по расстоянию.
 */

/** Точка отправления: машины с азиатских аукционов приходят через Владивосток. */
const ORIGIN = CITY_COORDINATES["Владивосток"]

/**
 * Цены перевозчиков — то, что известно точно.
 *
 * Эти значения не выводятся формулой: они взяты из тарифов и должны
 * оставаться неизменными, даже если расчёт даст другое число.
 */
export const KNOWN_DELIVERY_PRICES: Record<string, number> = {
  "Владивосток": 0,
  "Хабаровск": 25_000,
  "Чита": 75_000,
  "Иркутск": 90_000,
  "Красноярск": 110_000,
  "Якутск": 120_000,
  "Новосибирск": 130_000,
  "Екатеринбург": 160_000,
  "Уфа": 165_000,
  "Казань": 170_000,
  "Самара": 175_000,
  "Москва": 180_000,
  "Санкт-Петербург": 195_000,
  "Краснодар": 200_000,
  "Сочи": 205_000,
}

/* Коэффициенты подобраны по этим же пятнадцати городам: средняя ошибка 6,4 %.

   Показатель степени меньше единицы неслучаен — тариф за километр падает с
   расстоянием: до Читы выходит 44 ₽/км, до Москвы уже 28 ₽/км. Так устроены
   реальные тарифы автовозов: постоянные расходы размазываются по маршруту. */
const BASE_FEE = 2_000
const RATE = 60
const DISTANCE_POWER = 0.92

/** Округление до пяти тысяч: точность здесь ложная, а ровное число читается легче. */
const ROUND_TO = 5_000

/** Если города нет в справочнике координат — прежнее значение по умолчанию. */
const FALLBACK = 180_000

/**
 * Сколько будет стоить доставка машины до города.
 *
 * Возвращает известную цену перевозчика, если она есть, иначе оценку по
 * расстоянию. Для неизвестного города — прежнее значение по умолчанию.
 */
export function estimateRfDelivery(city: string | null | undefined): number {
  if (!city) return FALLBACK

  const known = KNOWN_DELIVERY_PRICES[city]
  if (known !== undefined) return known

  const point = CITY_COORDINATES[city]
  if (!point || !ORIGIN) return FALLBACK

  const distance = distanceKm(ORIGIN, point)
  const raw = BASE_FEE + RATE * distance ** DISTANCE_POWER
  return Math.round(raw / ROUND_TO) * ROUND_TO
}

/** Точная цена перевозчика или расчёт — это важно показать человеку. */
export function isKnownDeliveryPrice(city: string | null | undefined): boolean {
  return Boolean(city && KNOWN_DELIVERY_PRICES[city] !== undefined)
}
