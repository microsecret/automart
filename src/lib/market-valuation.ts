/**
 * Рыночная оценка автомобиля по сопоставимым лотам.
 *
 * Прежняя оценка брала за основу цену, которую продавец сам же и
 * указал, умножала её на возраст, пробег и состояние — и всегда
 * возвращала число меньше введённого. Человек спрашивал «сколько стоит
 * моя машина», а получал «на столько-то меньше, чем вы написали». Про
 * рынок это не говорило ничего.
 *
 * Здесь оценка строится от сделок: в базе больше восьми тысяч лотов с
 * ценой и пробегом из десяти источников. Берутся похожие машины, их
 * цены приводятся к возрасту и пробегу оцениваемой, и по этому ряду
 * считается медиана.
 *
 * Почему медиана, а не среднее: в аукционных данных попадаются битые
 * машины по цене металлолома и единичные экземпляры втрое дороже
 * рынка. Среднее они утаскивают за собой, медиана — нет.
 *
 * Модуль без импортов и без базы: правила должны проверяться тестами
 * на списке, а не на живых данных.
 */

/** Лот, с которым сравниваем. Ровно те поля, что есть у всех источников. */
export type ComparableListing = {
  make: string
  model: string
  year: number
  mileage: number | null
  priceRub: number
}

export type ValuationSubject = {
  make: string
  model: string
  year: number
  mileage: number | null
}

export type MarketValuation = {
  /** Медианная цена приведённых сопоставимых лотов, рубли. */
  estimatedValue: number
  /** Разумный коридор торга: четверти ряда, а не проценты от медианы. */
  min: number
  max: number
  /** Сколько лотов легло в основу. */
  sampleSize: number
  /** По каким признакам подобраны: чем уже, тем точнее. */
  matchLevel: "model" | "make" | "segment"
  confidencePercent: number
  confidenceLabel: "высокая" | "средняя" | "низкая"
}

/**
 * Насколько дешевеет машина за год.
 *
 * Восемь процентов — обычный шаг для массового сегмента: за пять лет
 * машина теряет около трети. Точнее без марочной статистики не скажешь,
 * а выдумывать разные коэффициенты по маркам значило бы изображать
 * знание, которого у нас нет.
 */
const YEARLY_DEPRECIATION = 0.08

/**
 * Насколько дешевеет машина за сто тысяч километров.
 *
 * Двенадцать процентов. Пробег и возраст связаны, поэтому коэффициент
 * ниже годового: иначе одно и то же старение считалось бы дважды.
 */
const MILEAGE_DEPRECIATION_PER_100K = 0.12

/** Ниже этой доли цену не опускаем: машина стоит хотя бы как железо. */
const FLOOR_RATIO = 0.25

/** Сколько лотов нужно, чтобы медиана что-то значила. */
const MIN_SAMPLE = 3

function median(values: number[]) {
  if (values.length === 0) return null
  const sorted = [...values].sort((first, second) => first - second)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? Math.round((sorted[middle - 1] + sorted[middle]) / 2)
    : sorted[middle]
}

/** Значение квартиля: по нему строится коридор торга. */
function quantile(values: number[], share: number) {
  if (values.length === 0) return null
  const sorted = [...values].sort((first, second) => first - second)
  const position = (sorted.length - 1) * share
  const lower = Math.floor(position)
  const upper = Math.ceil(position)
  if (lower === upper) return sorted[lower]
  return Math.round(sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower))
}

/** Первое слово модели: «MODEL 3 2023» и «Model 3» — одна машина. */
function normalizeModel(model: string) {
  return model.trim().toLocaleLowerCase("ru-RU").split(/[\s\-_/]+/)[0] || ""
}

function normalizeMake(make: string) {
  return make.trim().toLocaleLowerCase("ru-RU")
}

/**
 * Приводит цену чужого лота к состоянию оцениваемой машины.
 *
 * Сопоставимый лот почти никогда не совпадает точно: он на год старше
 * или на сорок тысяч пробега свежее. Без поправки такие лоты пришлось
 * бы отбрасывать, и выборка схлопывалась бы до нуля.
 */
export function adjustToSubject(listing: ComparableListing, subject: ValuationSubject) {
  const yearsApart = subject.year - listing.year
  /* Оцениваемая машина новее — цена лота растёт, старше — падает. */
  const ageAdjustment = (1 - YEARLY_DEPRECIATION) ** -yearsApart

  const listingMileage = listing.mileage ?? null
  const subjectMileage = subject.mileage ?? null
  const mileageAdjustment = listingMileage !== null && subjectMileage !== null
    ? 1 - ((subjectMileage - listingMileage) / 100_000) * MILEAGE_DEPRECIATION_PER_100K
    : 1

  const adjusted = listing.priceRub * ageAdjustment * Math.max(0.4, mileageAdjustment)
  return Math.max(Math.round(listing.priceRub * FLOOR_RATIO), Math.round(adjusted))
}

/**
 * Отбирает сопоставимые лоты, сужая круг от точного к общему.
 *
 * Сначала та же марка и модель — это лучший ответ. Если таких мало,
 * берётся марка целиком: «Kia пятилетней давности» всё ещё говорит о
 * цене больше, чем ничего. Дальше — машины того же года выпуска
 * независимо от марки; это грубо, и уверенность соответствующая.
 */
export function selectComparables(listings: ComparableListing[], subject: ValuationSubject) {
  const subjectMake = normalizeMake(subject.make)
  const subjectModel = normalizeModel(subject.model)

  const sameModel = listings.filter((listing) => (
    normalizeMake(listing.make) === subjectMake
    && normalizeModel(listing.model) === subjectModel
    && Math.abs(listing.year - subject.year) <= 4
  ))
  if (sameModel.length >= MIN_SAMPLE) return { comparables: sameModel, matchLevel: "model" as const }

  const sameMake = listings.filter((listing) => (
    normalizeMake(listing.make) === subjectMake
    && Math.abs(listing.year - subject.year) <= 3
  ))
  if (sameMake.length >= MIN_SAMPLE) return { comparables: sameMake, matchLevel: "make" as const }

  const sameYears = listings.filter((listing) => Math.abs(listing.year - subject.year) <= 2)
  return { comparables: sameYears, matchLevel: "segment" as const }
}

/**
 * Насколько можно верить оценке.
 *
 * Три вещи: по каким признакам подобраны лоты, сколько их и насколько
 * они согласны между собой. Двадцать лотов той же модели с близкими
 * ценами — это оценка; три разномастных лота того же года — догадка, и
 * человек должен видеть разницу.
 */
function scoreConfidence(prices: number[], matchLevel: MarketValuation["matchLevel"], estimate: number) {
  const levelWeight = matchLevel === "model" ? 1 : matchLevel === "make" ? 0.62 : 0.3
  /* Двадцати лотов достаточно для полного веса по размеру выборки. */
  const sizeWeight = Math.min(1, prices.length / 20)

  /* Согласие: половина медианного разброса. Чем теснее цены жмутся к
     медиане, тем меньше шанс, что мы поймали случайный ряд. */
  const spread = estimate > 0
    ? prices.reduce((sum, price) => sum + Math.abs(price - estimate), 0) / prices.length / estimate
    : 1
  const agreementWeight = Math.max(0, 1 - spread * 1.6)

  const percent = Math.round(100 * levelWeight * (0.35 + 0.35 * sizeWeight + 0.3 * agreementWeight))
  const bounded = Math.max(5, Math.min(96, percent))
  return {
    confidencePercent: bounded,
    confidenceLabel: (bounded >= 70 ? "высокая" : bounded >= 45 ? "средняя" : "низкая") as MarketValuation["confidenceLabel"],
  }
}

/**
 * Считает рыночную оценку. Возвращает null, когда сравнивать не с чем —
 * это честнее выдуманного числа.
 */
export function valuateFromMarket(listings: ComparableListing[], subject: ValuationSubject): MarketValuation | null {
  const usable = listings.filter((listing) => listing.priceRub > 0)
  const { comparables, matchLevel } = selectComparables(usable, subject)
  if (comparables.length < MIN_SAMPLE) return null

  const adjusted = comparables.map((listing) => adjustToSubject(listing, subject))
  const estimate = median(adjusted)
  if (estimate === null) return null

  /* Коридор — четверти ряда, а не проценты от медианы. Плюс-минус
     двенадцать процентов выглядели одинаково уверенно и на плотном
     ряду, и на разбросанном, хотя это разные ситуации. */
  const low = quantile(adjusted, 0.25) ?? estimate
  const high = quantile(adjusted, 0.75) ?? estimate

  return {
    estimatedValue: estimate,
    min: Math.min(low, estimate),
    max: Math.max(high, estimate),
    sampleSize: comparables.length,
    matchLevel,
    ...scoreConfidence(adjusted, matchLevel, estimate),
  }
}
