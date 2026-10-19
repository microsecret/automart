import test from "node:test"
import assert from "node:assert/strict"
import { savedSearchSummary } from "../src/lib/saved-search-summary.mjs"

test("auction summary translates country/body and formats the actual price", () => {
  assert.deepEqual(savedSearchSummary("country=JP&make=Honda&bodyType=SUV&priceTo=2000000"), [
    { label: "Марка", value: "Honda" }, { label: "Страна", value: "Япония" },
    { label: "Кузов", value: "Кроссовер" }, { label: "Цена до", value: new Intl.NumberFormat("ru-RU").format(2000000) + " ₽" },
  ])
})

test("preview omits unknown parameters and bounds user text", () => {
  assert.deepEqual(savedSearchSummary("redirect=https://example.invalid&sort=newest"), [])
  assert.equal(savedSearchSummary(`make=${"a".repeat(300)}`)[0].value.length, 120)
  assert.deepEqual(savedSearchSummary(""), [])
})

test("invalid prices are not silently converted to another amount", () => {
  assert.deepEqual(savedSearchSummary("priceTo=1e6"), [{ label: "Цена до", value: "1e6" }])
  assert.deepEqual(savedSearchSummary("country=KR&yearFrom=2023"), [{ label: "Страна", value: "Корея" }, { label: "Год от", value: "2023" }])
})
