import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { buildNotificationText, matchesChange, shouldNotify } from "../src/lib/fuel-subscription.ts"

const NOW = new Date("2026-08-29T12:00:00Z")
const ago = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000)

const change = {
  stationId: "osm-node-42",
  stationName: "Башнефть, Свободы 76а/2",
  city: "Уфа",
  fuel: "AI92",
  fuelLabel: "92",
}

const base = { stationId: null, fuel: null, city: null, lastNotifiedAt: null, createdAt: ago(60) }

test("подписка на заправку срабатывает на любое топливо", () => {
  const row = { ...base, kind: "STATION", stationId: "osm-node-42" }
  assert.equal(matchesChange(row, change), true)
  assert.equal(matchesChange(row, { ...change, fuel: "DT", fuelLabel: "ДТ" }), true)
})

test("подписка на марку здесь не срабатывает на другую марку", () => {
  const row = { ...base, kind: "STATION_FUEL", stationId: "osm-node-42", fuel: "AI95" }
  assert.equal(matchesChange(row, change), false)
})

test("подписка на марку по городу не привязана к заправке", () => {
  /* Самый частый случай в дефицит: человеку всё равно куда ехать, лишь
     бы был 92-й. */
  const row = { ...base, kind: "CITY_FUEL", fuel: "AI92", city: "Уфа" }
  assert.equal(matchesChange(row, change), true)
  assert.equal(matchesChange(row, { ...change, stationId: "osm-node-999" }), true)
})

test("город сравнивается без учёта регистра", () => {
  /* В базе он из справочника точек, в подписке — из выбранного человеком
     города, и регистр расходится. */
  const row = { ...base, kind: "CITY_FUEL", fuel: "AI92", city: "уфа " }
  assert.equal(matchesChange(row, change), true)
})

test("чужой город не срабатывает", () => {
  const row = { ...base, kind: "CITY_FUEL", fuel: "AI92", city: "Казань" }
  assert.equal(matchesChange(row, change), false)
})

test("второе уведомление за час не уходит", () => {
  /* Топливо появляется и заканчивается волнами: без паузы человек получил
     бы пять сообщений за час и выключил бота. */
  const row = { ...base, kind: "STATION", stationId: "osm-node-42", lastNotifiedAt: ago(20) }
  assert.equal(shouldNotify(row, change, NOW).send, false)
  assert.equal(shouldNotify(row, change, NOW).reason, "cooldown")
})

test("через час уведомление снова уходит", () => {
  const row = { ...base, kind: "STATION", stationId: "osm-node-42", lastNotifiedAt: ago(90) }
  assert.equal(shouldNotify(row, change, NOW).send, true)
})

test("молчаливая подписка засыпает", () => {
  /* Человек подписался в дефицит, заправился и забыл. Через месяц
     уведомление для него шум, и он уходит из бота целиком. */
  const row = { ...base, kind: "STATION", stationId: "osm-node-42", createdAt: ago(60 * 24 * 40) }
  const decision = shouldNotify(row, change, NOW)
  assert.equal(decision.send, false)
  assert.equal(decision.reason, "asleep")
})

test("свежая подписка не считается уснувшей", () => {
  const row = { ...base, kind: "STATION", stationId: "osm-node-42", createdAt: ago(10) }
  assert.equal(shouldNotify(row, change, NOW).send, true)
})

test("в уведомлении первым стоит название заправки", () => {
  // По нему человек решает, ехать ли, — а не по марке, которую он знает.
  const text = buildNotificationText(change, "STATION_FUEL")
  assert.ok(text.indexOf("Башнефть") < text.indexOf("Появился"))
})

test("по городской подписке в тексте есть город", () => {
  // Человек не знает эту заправку: город помогает понять, далеко ли.
  const text = buildNotificationText(change, "CITY_FUEL")
  assert.ok(text.includes("Уфа"))
})

test("уведомление честно предупреждает", () => {
  /* Пока едете, могут разобрать: обещать наличие по чужой отметке
     нельзя, а разочарование запомнится. */
  const text = buildNotificationText(change, "STATION")
  assert.match(text, /могут разобрать/)
})

test("теги в названии заправки экранируются", () => {
  const text = buildNotificationText({ ...change, stationName: "АЗС <b>№1</b>" }, "STATION")
  assert.ok(text.includes("&lt;b&gt;"))
})

// === Устройство ===

test("подписчиков будим только на переходе «нет» → «есть»", () => {
  /* Иначе каждая отметка «есть 92» там, где он и так весь день есть,
     слала бы уведомление всем подписчикам. */
  const route = readFileSync(new URL("../src/app/api/fuel-availability/route.ts", import.meta.url), "utf8")
  assert.match(route, /wasAvailable\.has\(entry\.fuel\)/)
  assert.match(route, /entry\.state !== "YES" \|\| wasAvailable/)
})

test("чужую подписку снять нельзя", () => {
  const route = readFileSync(new URL("../src/app/api/fuel-subscriptions/route.ts", import.meta.url), "utf8")
  assert.match(route, /deleteMany\(\{\s*where: \{ id, userId: session\.user\.id \}/)
})

test("подписка требует входа", () => {
  // Уведомление уходит в бот, а его адрес известен только вошедшему.
  const route = readFileSync(new URL("../src/app/api/fuel-subscriptions/route.ts", import.meta.url), "utf8")
  assert.match(route, /Войдите, чтобы подписаться/)
})
