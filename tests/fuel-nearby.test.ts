import assert from "node:assert/strict"
import test from "node:test"
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { distanceKm, formatDistance, sortByFuelAndDistance } from "../src/lib/fuel-nearby.ts"

const UFA = { latitude: 54.7351, longitude: 55.9587 }

test("расстояние считается верно", () => {
  /* Уфа — Казань 450 км по прямой (по дорогам 525, но здесь именно
     прямая: маршрут считает навигатор). */
  const kazan = { latitude: 55.7963, longitude: 49.1088 }
  const km = distanceKm(UFA, kazan)
  assert.ok(km > 440 && km < 460, `получилось ${km}`)

  // Уфа — Москва 1165 км по прямой.
  const moscow = { latitude: 55.7558, longitude: 37.6173 }
  assert.ok(distanceKm(UFA, moscow) > 1150, "Москва должна быть дальше Казани")
})

test("расстояние до себя — ноль", () => {
  assert.equal(Math.round(distanceKm(UFA, UFA)), 0)
})

test("близкое расстояние показывается в метрах", () => {
  /* «350 м» человек понимает сразу, а «0,35 км» приходится переводить в
     уме. */
  assert.equal(formatDistance(0.35), "350 м")
  assert.equal(formatDistance(0.02), "50 м")
  assert.equal(formatDistance(2.4), "2,4 км")
  assert.equal(formatDistance(17.6), "18 км")
})

const stations = [
  { id: "a", name: "Ближняя без отметок", latitude: 54.7360, longitude: 55.9590 },
  { id: "b", name: "Средняя с топливом", latitude: 54.7500, longitude: 55.9700 },
  { id: "c", name: "Дальняя с топливом", latitude: 54.8000, longitude: 56.0000 },
  { id: "d", name: "Ближняя пустая", latitude: 54.7355, longitude: 55.9588 },
]

const availability = {
  b: [{ fuel: "AI92", state: "YES", updatedAt: "2026-08-29T12:00:00Z" }],
  c: [{ fuel: "AI92", state: "YES", updatedAt: "2026-08-29T11:00:00Z" }],
  d: [{ fuel: "AI92", state: "NO", updatedAt: "2026-08-29T12:00:00Z" }],
}

test("сначала заправки с топливом, по расстоянию", () => {
  const rows = sortByFuelAndDistance(stations, UFA, availability, "AI92")
  assert.equal(rows[0].station.id, "b", "ближайшая с топливом должна быть первой")
  assert.equal(rows[1].station.id, "c")
})

test("неотмеченные идут после отмеченных, но раньше пустых", () => {
  /* Отсутствие сведений — не отсутствие топлива: ближайшая неотмеченная
     может оказаться лучшим вариантом, когда отмеченные далеко. */
  const rows = sortByFuelAndDistance(stations, UFA, availability, "AI92")
  assert.equal(rows[2].station.id, "a")
  assert.equal(rows[3].station.id, "d", "заправка с «нет» должна быть последней")
})

test("пустая заправка не выбрасывается из списка", () => {
  // Человек должен видеть, что там смотрели и топлива не было.
  const rows = sortByFuelAndDistance(stations, UFA, availability, "AI92")
  assert.equal(rows.length, 4)
  assert.equal(rows[3].hasFuel, false)
})

test("отметка о другой марке не влияет на выдачу", () => {
  const rows = sortByFuelAndDistance(stations, UFA, availability, "AI95")
  // Про 95-й никто не отмечал — все заправки равны, порядок по расстоянию.
  assert.equal(rows.every((row) => row.hasFuel === false), true)
  assert.ok(rows[0].km <= rows[1].km)
})

test("возраст отметки доходит до списка", () => {
  // По нему человек решает, верить ли: свежее «есть» и вчерашнее — разное.
  const rows = sortByFuelAndDistance(stations, UFA, availability, "AI92")
  assert.equal(rows[0].updatedAt, "2026-08-29T12:00:00Z")
  assert.equal(rows[2].updatedAt, null)
})

test("пустой список не роняет разбор", () => {
  assert.deepEqual(sortByFuelAndDistance([], UFA, {}, "AI92"), [])
})
