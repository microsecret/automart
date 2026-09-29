import assert from "node:assert/strict"
import test from "node:test"
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { isCompleteRegionAnswer, isVanishedFromSource, shouldPruneRegion, vanishedCutoff } from "../src/lib/fuel-station-freshness.ts"

// Точки и числа — из боевой базы 29 сентября 2026, а не придуманы.

const NOW = new Date("2026-09-29T12:00:00Z")
const UFA = { lat1: 54.50, lon1: 55.60, lat2: 55.00, lon2: 56.40 }
const DAY = 24 * 60 * 60_000

test("«Татнефть» в центре Уфы, снятая источником 19.09, считается пропавшей", () => {
  // Пользовательская метка ГдеБЕНЗ usr_e21XOJ17d2w: ни цен, ни адреса.
  const ghost = { latitude: 54.73705, longitude: 55.94319, updatedAt: new Date("2026-09-19T11:30:00Z") }
  assert.equal(isVanishedFromSource(ghost, UFA, NOW), true)
})

test("точка, пришедшая в последнем прогоне, не трогается", () => {
  // Настоящая «Татнефть» на М-5, 1483-й км: источник отдаёт её каждый прогон.
  const live = { latitude: 54.68504, longitude: 56.19795, updatedAt: new Date("2026-09-29T11:17:00Z") }
  assert.equal(isVanishedFromSource(live, UFA, NOW), false)
})

test("один-два сорванных прогона точку не удаляют", () => {
  // Меньше трёх суток тишины — это сбой запроса, а не исчезновение.
  const quiet = { latitude: 54.74, longitude: 55.96, updatedAt: new Date(NOW.getTime() - 2 * DAY) }
  assert.equal(isVanishedFromSource(quiet, UFA, NOW), false)
  assert.equal(vanishedCutoff(NOW).getTime(), NOW.getTime() - 3 * DAY)
})

test("точка чужого региона не удаляется по ответу этого региона", () => {
  // Стерлитамак вне прямоугольника Уфы: ответ по Уфе о нём ничего не говорит.
  const elsewhere = { latitude: 53.63, longitude: 55.95, updatedAt: new Date("2026-09-01T00:00:00Z") }
  assert.equal(isVanishedFromSource(elsewhere, UFA, NOW), false)
})

test("обрезанный потолком ответ ГдеЗаправки не даёт права чистить", () => {
  // «Западная Сибирь»: ровно 2000 станций в ответе, 308 точек в него не влезли.
  assert.equal(isCompleteRegionAnswer("GDEZAPRAVKA", 2000), false)
  assert.equal(isCompleteRegionAnswer("GDEZAPRAVKA", 224), true)
  assert.equal(shouldPruneRegion({ source: "GDEZAPRAVKA", fetched: 2000, vanished: 308, total: 2308 }), false)
})

test("пустой ответ — сбой источника, а не исчезновение всех заправок", () => {
  assert.equal(isCompleteRegionAnswer("GDEBENZ", 0), false)
  assert.equal(shouldPruneRegion({ source: "GDEBENZ", fetched: 0, vanished: 155, total: 155 }), false)
})

test("источники, которые режут регион на клетки, не чистятся", () => {
  // У Яндекса и Т-Банка отсутствие точки в одном прогоне ничего не доказывает.
  assert.equal(isCompleteRegionAnswer("YANDEX", 50), false)
  assert.equal(isCompleteRegionAnswer("TBANK", 50), false)
  assert.equal(isCompleteRegionAnswer("TWOGIS", 50), false)
})

test("полный ответ по Уфе разрешает удалить одиннадцать пропавших точек", () => {
  // ГдеБЕНЗ по Уфе: 155 точек в прямоугольнике, 11 не приходили больше трёх суток.
  assert.equal(shouldPruneRegion({ source: "GDEBENZ", fetched: 144, vanished: 11, total: 155 }), true)
})

test("треть региона разом — ещё хвост перенумерации, больше половины — уже подозрительно", () => {
  // Казань у ГдеБЕНЗ: 120 из 348 — наибольшая доля по базе.
  assert.equal(shouldPruneRegion({ source: "GDEBENZ", fetched: 227, vanished: 120, total: 348 }), true)
  // Источник вдруг отдал малую часть региона: так чистить нельзя.
  assert.equal(shouldPruneRegion({ source: "GDEBENZ", fetched: 40, vanished: 300, total: 340 }), false)
})

test("нечего удалять — нечего и разрешать", () => {
  assert.equal(shouldPruneRegion({ source: "GDEZAPRAVKA", fetched: 224, vanished: 0, total: 224 }), false)
})
