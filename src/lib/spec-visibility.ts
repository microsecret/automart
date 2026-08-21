/**
 * Отбор характеристик, которые стоит показывать.
 *
 * У импортных лотов заполнена лишь часть полей: у грузовика из одиннадцати
 * характеристик восемь были прочерками. Человек листал пустоту, а редкие
 * заполненные значения терялись среди них.
 *
 * Вынесено отдельно от страницы: это правило решает, что видит покупатель,
 * и его дешевле проверить тестом, чем ловить глазами на боевой странице.
 */

/** Значения, которые считаются отсутствующими. */
const EMPTY_MARKERS = new Set(["", "—", "-", "–", "N/A", "null", "undefined"])

export function isMeaningfulSpecValue(value: unknown): boolean {
  if (value === null || value === undefined) return false
  const text = String(value).trim()
  if (EMPTY_MARKERS.has(text)) return false
  // «0 км» у нового транспорта — настоящее значение, а не пустое поле.
  return true
}

export function filterMeaningfulSpecs<T extends { value: unknown }>(specs: T[]): T[] {
  return specs.filter((spec) => isMeaningfulSpecValue(spec.value))
}
