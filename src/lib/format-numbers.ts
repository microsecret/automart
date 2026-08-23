/**
 * Числа, которые читает покупатель: цена, пробег, объём.
 *
 * Вынесено из `format.ts` отдельным модулем без зависимостей: тот тянет
 * разбор адресов картинок, и проверить правила набора без запуска всего
 * приложения было нельзя.
 *
 * Главное правило здесь — неразрывный пробел. С обычным «8,8 млн ₽» в
 * узкой карточке рвалось на «8,8» и «млн ₽», а «165 000 км» — посередине
 * числа. Цена и пробег это то, по чему принимают решение; разорванными
 * они читаются как ошибка вёрстки.
 */

/** Неразрывный пробел: держит число и единицу вместе. */
const NBSP = "\u00a0"

/**
 * Краткая цена: «4,5 млн ₽» вместо «4 500 000 ₽».
 *
 * Сокращения по правилам: «тыс.» с точкой, «млн» без — сокращение,
 * оканчивающееся согласной, точкой не закрывается.
 */
export function formatPriceShort(price: number | null | undefined): string {
  if (price == null || !Number.isFinite(price)) return "Договорная"

  if (price >= 1_000_000) {
    const mln = price / 1_000_000
    const value = mln % 1 === 0 ? mln.toFixed(0) : mln.toFixed(1).replace(".", ",")
    return `${value}${NBSP}млн${NBSP}₽`
  }

  if (price >= 1_000) {
    return `${(price / 1_000).toFixed(0)}${NBSP}тыс.${NBSP}₽`
  }

  return `${price}${NBSP}₽`
}

/**
 * Пробег: «165 000 км».
 *
 * Разделители разрядов тоже неразрывные — иначе число рвётся посередине.
 */
export function formatMileage(mileage: number | null | undefined): string {
  if (mileage == null || !Number.isFinite(mileage)) return "—"
  const digits = new Intl.NumberFormat("ru-RU").format(mileage).replace(/\s/g, NBSP)
  return `${digits}${NBSP}км`
}

/**
 * Объём двигателя: «2,0 л».
 *
 * Всегда с одним знаком после запятой: «2 л» и «2,0 л» в соседних
 * карточках читаются как разная точность измерения.
 *
 * Прочерк вместо пустоты — так же, как у пробега: ячейка характеристики
 * не должна оставаться пустой, иначе непонятно, данных нет или их не
 * показали.
 */
export function formatEngineVolume(volume: number | null | undefined): string {
  if (volume == null || !Number.isFinite(volume) || volume <= 0) return "—"
  return `${volume.toFixed(1).replace(".", ",")}${NBSP}л`
}

/** Мощность: «150 л.с.» — у электротяги она заменяет объём. */
export function formatPower(power: number | null | undefined): string {
  if (power == null || !Number.isFinite(power) || power <= 0) return "—"
  return `${Math.round(power)}${NBSP}л.с.`
}
