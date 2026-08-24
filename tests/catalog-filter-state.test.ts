import assert from "node:assert/strict"
import test from "node:test"
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { countActiveCatalogFilters } from "../src/lib/catalog-filter-state.ts"

test("текстовый запрос считается активным условием", () => {
  assert.equal(countActiveCatalogFilters(["Nissan", null, [], ""]), 1)
})

test("мультиселект считается одним условием независимо от числа значений", () => {
  assert.equal(countActiveCatalogFilters([["DIESEL", "HYBRID"], ["SEDAN"]]), 2)
})

test("явно выбранное false остаётся активным фильтром", () => {
  assert.equal(countActiveCatalogFilters([false, null, undefined]), 1)
})

test("пробелы, пустые массивы и отсутствующие значения не считаются", () => {
  assert.equal(countActiveCatalogFilters(["   ", [], null, undefined]), 0)
})
