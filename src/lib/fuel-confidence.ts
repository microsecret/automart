/**
 * Насколько можно верить отметке о наличии топлива.
 *
 * Карта говорила «есть 92» или «нет 92» — уверенно, как факт. Но за этим
 * могла стоять одна отметка восьмичасовой давности от случайного
 * человека, и поехавший по ней возвращался ни с чем. Второй раз он на
 * карту уже не смотрел.
 *
 * Честнее сказать, насколько сведения крепкие: одна метка за восемь часов
 * — это половина уверенности, три свежих подтверждения — почти полная.
 * Тогда человек сам решает, ехать или проверить телефоном, и не винит
 * сервис, если топливо разобрали.
 *
 * Что влияет на уверенность:
 *
 * • Свежесть. Отметка получаса стоит больше, чем шестичасовая: топливо
 *   разбирают за час-два.
 * • Число подтверждений. Пятеро видели одно и то же — это уже не мнение.
 * • Согласие. Когда трое говорят «есть», а двое «нет», уверенности мало
 *   независимо от их количества.
 * • Кто отметил. У вошедшего в учётную запись отметка весит больше:
 *   анонимную накрутить проще, и она чаще случайна.
 *
 * Модуль без импортов: правила должны проверяться тестами без базы.
 */

/** Полный вес отметки держится полчаса. */
const FULL_WEIGHT_MS = 30 * 60 * 1000

/** К шести часам вес падает почти до нуля. */
const ZERO_WEIGHT_MS = 6 * 60 * 60 * 1000

/**
 * Вклад отметки от вошедшего человека против анонимной.
 *
 * Полуторный, а не двойной: анонимные отметки — большая часть, и
 * обесценивать их значило бы получать пустую карту в городах, где мало
 * зарегистрированных.
 */
const AUTHORIZED_BONUS = 1.5

/**
 * Сколько веса нужно для полной уверенности.
 *
 * Три свежих отметки от вошедших людей дают 4.5 — этого достаточно.
 * Планка не выше, потому что карта живая: требовать десять подтверждений
 * значит показывать «мало данных» там, где всё известно.
 */
const FULL_CONFIDENCE_WEIGHT = 4

export type ConfidenceReport = {
  state: "YES" | "NO"
  createdAt: Date
  /** Отметил вошедший в учётную запись, а не аноним. */
  authorized?: boolean
}

export type Confidence = {
  /** От 0 до 100 — насколько крепкие сведения. */
  percent: number
  /** Словами: по нему человек решает быстрее, чем по числу. */
  label: "высокая" | "средняя" | "низкая"
  /** Сколько отметок легло в основу. */
  reports: number
  /** За какой срок они собраны, в часах; null — отметок нет. */
  hours: number | null
}

/**
 * Вес одной отметки по её возрасту.
 *
 * Полчаса — полный вес, дальше спад до нуля к шести часам. Спад линейный,
 * а не резкий: обрыв на границе означал бы, что отметка «пять часов
 * пятьдесят девять минут» весит вдвое больше, чем «шесть часов одна
 * минута», а разницы между ними нет.
 */
export function ageWeight(createdAt: Date, now: Date = new Date()): number {
  const age = now.getTime() - createdAt.getTime()
  if (age <= FULL_WEIGHT_MS) return 1
  if (age >= ZERO_WEIGHT_MS) return 0
  return 1 - (age - FULL_WEIGHT_MS) / (ZERO_WEIGHT_MS - FULL_WEIGHT_MS)
}

/**
 * Считает уверенность по отметкам одного вида топлива.
 *
 * Отметки должны быть уже отобраны по марке: сводить 92-й с дизелем
 * бессмысленно.
 */
export function calculateConfidence(
  reports: readonly ConfidenceReport[],
  now: Date = new Date(),
): Confidence {
  if (reports.length === 0) {
    return { percent: 0, label: "низкая", reports: 0, hours: null }
  }

  let yesWeight = 0
  let noWeight = 0

  for (const report of reports) {
    const weight = ageWeight(report.createdAt, now) * (report.authorized ? AUTHORIZED_BONUS : 1)
    if (report.state === "YES") yesWeight += weight
    else noWeight += weight
  }

  const total = yesWeight + noWeight
  if (total === 0) {
    /* Все отметки старше шести часов: они ещё показываются на карте, но
       верить им нельзя. */
    return { percent: 0, label: "низкая", reports: reports.length, hours: hoursSpan(reports, now) }
  }

  /* Согласие: доля победившего мнения. Когда трое «за» и двое «против»,
     это 0.6 — и уверенность падает даже при обилии отметок. */
  const agreement = Math.max(yesWeight, noWeight) / total

  /* Достаточность: хватает ли веса вообще. Одна свежая отметка даёт 0.25,
     четыре — единицу. */
  const sufficiency = Math.min(1, total / FULL_CONFIDENCE_WEIGHT)

  /* Согласие важнее количества: десять отметок пополам не значат ничего,
     а две согласные уже кое-что. Отсюда квадрат у согласия. */
  const percent = Math.round(agreement * agreement * sufficiency * 100)

  return {
    percent,
    label: percent >= 70 ? "высокая" : percent >= 40 ? "средняя" : "низкая",
    reports: reports.length,
    hours: hoursSpan(reports, now),
  }
}

/** За сколько часов собраны отметки — для строки «1 метка за 8 ч». */
function hoursSpan(reports: readonly ConfidenceReport[], now: Date): number {
  const oldest = reports.reduce(
    (result, report) => Math.min(result, report.createdAt.getTime()),
    now.getTime(),
  )
  return Math.max(1, Math.round((now.getTime() - oldest) / (60 * 60 * 1000)))
}

/**
 * Строка под числом: «1 метка за 8 ч».
 *
 * Число само по себе непонятно — пятьдесят процентов чего? Строка
 * объясняет, из чего оно сложилось, и человек оценивает сам.
 */
export function describeConfidence(confidence: Confidence): string {
  if (confidence.reports === 0) return "никто не отмечал"

  const marks = confidence.reports === 1
    ? "1 метка"
    : `${confidence.reports} ${confidence.reports < 5 ? "метки" : "меток"}`

  return confidence.hours === null ? marks : `${marks} за ${confidence.hours} ч`
}
