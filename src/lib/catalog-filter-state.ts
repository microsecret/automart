export type CatalogFilterValue = string | readonly unknown[] | boolean | number | null | undefined

/**
 * Одно выбранное поле считается одним условием независимо от числа значений
 * внутри мультиселекта. `false` тоже является выбранным значением, например
 * для фильтра «растаможен: нет».
 */
export function countActiveCatalogFilters(values: readonly CatalogFilterValue[]): number {
  return values.reduce<number>((count, value) => {
    if (Array.isArray(value)) return count + (value.length > 0 ? 1 : 0)
    if (typeof value === "string") return count + (value.trim().length > 0 ? 1 : 0)
    return count + (value === null || value === undefined ? 0 : 1)
  }, 0)
}
