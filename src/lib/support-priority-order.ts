/**
 * Порядок обращений в поддержке по важности.
 *
 * Важность хранится строкой (`LOW`, `NORMAL`, `HIGH`, `URGENT`), и запрос
 * сортировал её по убыванию алфавита. Получалось
 * `URGENT → NORMAL → LOW → HIGH`: срочное всплывало наверх случайно, а
 * важное обращение оказывалось ниже низкоприоритетного. Оператор открывал
 * список сверху и брал не то.
 *
 * Базе порядок задать нельзя — поле строковое, а перечисления в схеме нет.
 * Зато значений всего четыре, и страница списка держит сорок обращений.
 * Поэтому выборка идёт группами: сначала все срочные, затем важные и так
 * далее — ровно столько, сколько нужно странице.
 */

/* Список значений повторён здесь намеренно, а не взят из `support-workspace`:
   тот модуль тянет за собой подключение к базе, и порядок важности нельзя
   было бы проверить тестом без запуска всего приложения. Проверка на
   совпадение со списком в `support-workspace` есть в тестах. */

/** От срочного к низкому — тот порядок, в котором оператор разбирает очередь. */
export const PRIORITY_ORDER = ["URGENT", "HIGH", "NORMAL", "LOW"] as const

/** Место важности в очереди: 0 — самая срочная. Неизвестное значение уходит вниз. */
export function priorityRank(priority: string): number {
  const index = (PRIORITY_ORDER as readonly string[]).indexOf(priority)
  return index === -1 ? PRIORITY_ORDER.length : index
}

/**
 * Что запросить у базы для одной страницы списка.
 *
 * Выдаёт по шагу на каждую важность: сколько её обращений пропустить и
 * сколько взять. Шаги, из которых ничего не нужно, не возвращаются — лишних
 * запросов не будет.
 *
 * @param counts сколько обращений каждой важности подходит под фильтры
 * @param skip сколько обращений пропустить (страница минус одна × размер)
 * @param take размер страницы
 */
export function planPriorityPage(
  counts: Record<string, number>,
  skip: number,
  take: number,
): Array<{ priority: string; skip: number; take: number }> {
  const plan: Array<{ priority: string; skip: number; take: number }> = []
  if (take <= 0) return plan

  // Сколько обращений осталось пропустить и сколько ещё нужно набрать.
  let toSkip = Math.max(0, skip)
  let toTake = take

  // Порядок обхода — важности по убыванию, затем всё незнакомое: если в базе
  // окажется значение вне списка, обращение не потеряется, а уйдёт в конец.
  const groups = [...PRIORITY_ORDER, ...Object.keys(counts).filter((key) => priorityRank(key) === PRIORITY_ORDER.length)]

  for (const priority of groups) {
    if (toTake <= 0) break
    const available = counts[priority] || 0
    if (available === 0) continue

    // Страница начинается позже этой группы — пропускаем её целиком.
    if (toSkip >= available) {
      toSkip -= available
      continue
    }

    const groupTake = Math.min(toTake, available - toSkip)
    plan.push({ priority, skip: toSkip, take: groupTake })
    toTake -= groupTake
    toSkip = 0
  }

  return plan
}
