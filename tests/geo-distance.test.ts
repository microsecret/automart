import assert from "node:assert/strict"
import test from "node:test"
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { citiesWithinRadius, distanceKm, parseRadius } from "../src/lib/geo-distance.ts"

// Известные расстояния по прямой — по ним сверяется расчёт.
const MOSCOW = { latitude: 55.7558, longitude: 37.6173 }
const SPB = { latitude: 59.9343, longitude: 30.3351 }
const VLADIVOSTOK = { latitude: 43.1155, longitude: 131.8855 }
const TVER = { latitude: 56.8587, longitude: 35.9176 }
const MURMANSK = { latitude: 68.9585, longitude: 33.0827 }

test("расстояние Москва — Петербург около 634 км", () => {
  const distance = distanceKm(MOSCOW, SPB)
  assert.ok(Math.abs(distance - 634) <= 10, `получено ${distance}`)
})

test("расстояние Москва — Владивосток около 6420 км", () => {
  const distance = distanceKm(MOSCOW, VLADIVOSTOK)
  assert.ok(Math.abs(distance - 6420) <= 60, `получено ${distance}`)
})

test("расстояние Москва — Тверь около 155 км", () => {
  const distance = distanceKm(MOSCOW, TVER)
  assert.ok(Math.abs(distance - 155) <= 8, `получено ${distance}`)
})

test("расстояние симметрично", () => {
  assert.equal(distanceKm(MOSCOW, SPB), distanceKm(SPB, MOSCOW))
})

test("расстояние до самой себя — ноль", () => {
  assert.equal(distanceKm(MOSCOW, MOSCOW), 0)
})

test("на северной широте градус долготы короче — плоский расчёт ошибся бы", () => {
  // Две точки на широте Мурманска, разница в долготе один градус.
  const north = distanceKm(MURMANSK, { latitude: 68.9585, longitude: 34.0827 })
  // Те же координаты по долготе, но на широте Москвы.
  const south = distanceKm(MOSCOW, { latitude: 55.7558, longitude: 38.6173 })
  assert.ok(north < south, `север ${north} км должен быть короче юга ${south} км`)
})

test("в радиус попадают только близкие города, отсортированные по удалённости", () => {
  const cities = {
    "Тверь": TVER,
    "Санкт-Петербург": SPB,
    "Владивосток": VLADIVOSTOK,
    "Москва": MOSCOW,
  }

  const within200 = citiesWithinRadius(MOSCOW, 200, cities)
  assert.deepEqual(within200, ["Москва", "Тверь"], "ближние города первыми, исходный включён")

  const within700 = citiesWithinRadius(MOSCOW, 700, cities)
  assert.ok(within700.includes("Санкт-Петербург"))
  assert.ok(!within700.includes("Владивосток"), "6420 км не попадает в 700")
})

test("исходный город остаётся в выдаче", () => {
  // Иначе фильтр «в радиусе 100 км» спрятал бы объявления из самого города.
  const result = citiesWithinRadius(MOSCOW, 50, { "Москва": MOSCOW, "Тверь": TVER })
  assert.deepEqual(result, ["Москва"])
})

test("радиус принимается только из предложенных значений", () => {
  assert.equal(parseRadius("200"), 200)
  assert.equal(parseRadius("50"), 50)
  assert.equal(parseRadius("500"), 500)
})

test("произвольный радиус из адреса отклоняется", () => {
  // Иначе запрос развернулся бы в сотни городов.
  assert.equal(parseRadius("99999"), null)
  assert.equal(parseRadius("173"), null)
  assert.equal(parseRadius("-100"), null)
  assert.equal(parseRadius("абв"), null)
  assert.equal(parseRadius(null), null)
  assert.equal(parseRadius(""), null)
})
