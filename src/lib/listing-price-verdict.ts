/**
 * Оценка цены объявления относительно похожих машин.
 *
 * Человек смотрит на «515 000 ₽» и не знает главного: дорого это или
 * дёшево. Ответ у площадки есть — в каталоге и в пятнадцати тысячах
 * аукционных лотов лежат цены на такие же машины, — но человек должен
 * добывать его сам, листая выдачу и держа числа в голове.
 *
 * Замер 17 сентября 2026: из сорока двух машин каталога у десяти
 * набирается хотя бы пять похожих для сравнения. Для остальных блок
 * молчит — и это не изъян, а условие: оценка по двум соседям хуже, чем
 * её отсутствие, потому что выглядит так же уверенно.
 */

export type PriceSample = {
  price: number
  year: number
}

export type PriceVerdictTone = "cheap" | "fair" | "pricey"

export type PriceVerdict = {
  tone: PriceVerdictTone
  /** Медианная цена похожих машин, рубли. */
  marketPrice: number
  /** Насколько цена отличается от медианы, доли: −0.18 = на 18% дешевле. */
  difference: number
  /** Сколько машин легло в расчёт — мера доверия к оценке. */
  sampleSize: number
}

/*
 * Сколько похожих машин нужно, чтобы оценка что-то значила.
 *
 * Пять — нижняя граница, на которой медиана перестаёт скакать от одного
 * случайного объявления. Меньше — и сравнивать не с чем: два соседа
 * дадут «дороже рынка на 40%» с той же уверенностью, что и сотня.
 */
const MIN_SAMPLE_SIZE = 5

/*
 * Разброс лет: машина того же года плюс-минус три.
 *
 * Год решает в цене больше всего после пробега, но требовать точного
 * совпадения нельзя — тогда для половины каталога сравнивать будет не с
 * чем. Три года в обе стороны сохраняют смысл сравнения и набирают
 * выборку.
 */
export const YEAR_SPREAD = 3

/*
 * Порог, за которым цена считается отличающейся от рынка.
 *
 * Десять процентов — это заметная для покупателя разница: на машине за
 * полмиллиона пятьдесят тысяч рублей. Ниже порога честнее сказать «по
 * рынку», чем придавать значение колебанию, которое объясняется
 * пробегом или комплектацией, а не выгодой.
 */
const SIGNIFICANT_DIFFERENCE = 0.1

function median(values: number[]): number {
  const sorted = [...values].sort((first, second) => first - second)
  const middle = Math.floor(sorted.length / 2)
  /* Нижняя из двух середин при чётном количестве: цена — не непрерывная
     величина, и полусумма даёт число, которого никто не просил. */
  return sorted[sorted.length % 2 === 0 ? middle - 1 : middle]
}

/**
 * Сравнивает цену объявления с ценами похожих машин.
 *
 * Возвращает `null`, когда сравнивать не с чем: молчание честнее
 * оценки, выведенной из двух случайных объявлений.
 */
export function buildPriceVerdict(
  price: number,
  samples: PriceSample[],
): PriceVerdict | null {
  if (!Number.isFinite(price) || price <= 0) return null

  const prices = samples
    .map((sample) => sample.price)
    .filter((value) => Number.isFinite(value) && value > 0)
  if (prices.length < MIN_SAMPLE_SIZE) return null

  const marketPrice = median(prices)
  if (marketPrice <= 0) return null

  const difference = (price - marketPrice) / marketPrice
  const tone: PriceVerdictTone = difference <= -SIGNIFICANT_DIFFERENCE
    ? "cheap"
    : difference >= SIGNIFICANT_DIFFERENCE
      ? "pricey"
      : "fair"

  return { tone, marketPrice, difference, sampleSize: prices.length }
}

/**
 * Словами: что именно значит оценка.
 *
 * Формулировки осторожные. «Дешевле рынка» — это про цену, а не про
 * выгоду: машина может стоить меньше потому, что она хуже, и обещать
 * человеку удачную покупку площадка не вправе.
 */
export function describePriceVerdict(verdict: PriceVerdict): string {
  const percent = Math.round(Math.abs(verdict.difference) * 100)
  if (verdict.tone === "cheap") return `На ${percent}% ниже похожих`
  if (verdict.tone === "pricey") return `На ${percent}% выше похожих`
  return "В рынке"
}
