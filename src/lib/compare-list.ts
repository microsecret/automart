/**
 * Список машин для сравнения.
 *
 * Страница сравнения на сайте была, но попасть в неё можно было только
 * вручную через адрес: в карточке каталога кнопки не было. Человек, который
 * выбирает между тремя вариантами, держал их в закладках браузера.
 *
 * Список живёт в браузере, а не в базе: сравнение — черновик выбора, оно не
 * должно требовать входа в аккаунт.
 */

const STORAGE_KEY = "compare-ids"

/**
 * Больше четырёх машин в таблицу не помещается: колонки становятся уже
 * названия характеристики, и сравнивать нечего.
 */
export const COMPARE_LIMIT = 4

/** Что сейчас в списке. */
export function readCompareList(): string[] {
  if (typeof window === "undefined") return []
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    return saved ? saved.split(",").filter(Boolean).slice(0, COMPARE_LIMIT) : []
  } catch {
    // Приватный режим браузера запрещает хранилище — сравнение просто не
    // запоминается, но страница работать не перестаёт.
    return []
  }
}

function writeCompareList(ids: string[]): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(STORAGE_KEY, ids.join(","))
    // Другие открытые вкладки и компоненты на этой же странице узнают об
    // изменении: событие storage между вкладками не работает для своей.
    window.dispatchEvent(new CustomEvent("compare-list-changed", { detail: ids }))
  } catch {
    // Хранилище недоступно — молча пропускаем.
  }
}

/**
 * Добавить или убрать машину из сравнения.
 *
 * Возвращает получившийся список и признак того, упёрлись ли в предел: об
 * этом человеку нужно сказать, иначе нажатие выглядит сломанным.
 */
export function toggleCompare(id: string): { ids: string[]; added: boolean; limitReached: boolean } {
  const current = readCompareList()

  if (current.includes(id)) {
    const ids = current.filter((value) => value !== id)
    writeCompareList(ids)
    return { ids, added: false, limitReached: false }
  }

  if (current.length >= COMPARE_LIMIT) {
    return { ids: current, added: false, limitReached: true }
  }

  const ids = [...current, id]
  writeCompareList(ids)
  return { ids, added: true, limitReached: false }
}

/** Очистить список — например, после того как выбор сделан. */
export function clearCompareList(): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.removeItem(STORAGE_KEY)
    window.dispatchEvent(new CustomEvent("compare-list-changed", { detail: [] }))
  } catch {
    // Хранилище недоступно — молча пропускаем.
  }
}

/**
 * Разбор списка из строки хранилища.
 *
 * Вынесено отдельно, чтобы правила — отсев пустых значений и предел в четыре
 * машины — можно было проверить тестами без браузера.
 */
export function parseCompareIds(raw: string | null): string[] {
  if (!raw) return []
  const unique: string[] = []
  for (const id of raw.split(",")) {
    const trimmed = id.trim()
    if (!trimmed || unique.includes(trimmed)) continue
    unique.push(trimmed)
    if (unique.length >= COMPARE_LIMIT) break
  }
  return unique
}
