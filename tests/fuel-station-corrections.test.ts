import assert from "node:assert/strict"
import test from "node:test"
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { applyStationCorrection } from "../src/lib/fuel-station-corrections.ts"

test("ложная «Татнефть» в Уфе получает верный бренд и теряет чужие цены", () => {
  const station = { source: "GDEZAPRAVKA", sourceId: "29901", brand: "Татнефть", name: "Татнефть", prices: [{ fuel: "AI95", price: 60 }] }
  const fixed = applyStationCorrection(station)
  assert.equal(fixed.brand, "АЗС Точка")
  assert.equal(fixed.name, "АЗС Точка")
  assert.deepEqual(fixed.prices, [])
})

test("точки без поправки не меняются", () => {
  const station = { source: "GDEBENZ", sourceId: "1", brand: "Лукойл", name: "Лукойл", prices: [{ fuel: "AI95", price: 60 }] }
  assert.equal(applyStationCorrection(station), station)
})
