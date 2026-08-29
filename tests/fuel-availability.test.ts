import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { formatAge, isFresh, summarizeAvailability } from "../src/lib/fuel-availability.ts"

const NOW = new Date("2026-08-29T12:00:00Z")
const ago = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000)

test("одна отметка «есть» показывает наличие", () => {
  const [row] = summarizeAvailability([{ fuel: "AI92", state: "YES", createdAt: ago(10) }], NOW)
  assert.equal(row.state, "YES")
  assert.equal(row.confirmations, 1)
})

test("при равенстве побеждает «нет»", () => {
  /* Съездить зря хуже, чем не поехать: человек, приехавший к пустой
     колонке, теряет полчаса и бак, а не поехавший — ничего. */
  const rows = summarizeAvailability([
    { fuel: "AI95", state: "YES", createdAt: ago(20) },
    { fuel: "AI95", state: "NO", createdAt: ago(15) },
  ], NOW)
  assert.equal(rows[0].state, "NO")
})

test("свежие отметки перевешивают старые", () => {
  /* Утреннее «нет» и дневное «есть»: подвоз был, и карта должна это
     показывать. */
  const rows = summarizeAvailability([
    { fuel: "AI92", state: "NO", createdAt: ago(400) },
    { fuel: "AI92", state: "YES", createdAt: ago(30) },
    { fuel: "AI92", state: "YES", createdAt: ago(20) },
  ], NOW)
  assert.equal(rows[0].state, "YES")
  assert.equal(rows[0].confirmations, 2)
})

test("вчерашние отметки не показываются", () => {
  // Вчерашнее «есть 92» не помогает никому.
  const rows = summarizeAvailability([{ fuel: "AI92", state: "YES", createdAt: ago(60 * 30) }], NOW)
  assert.equal(rows.length, 0)
})

test("молчание о топливе — не отсутствие", () => {
  /* Про 98-й никто не отмечал: это значит «не смотрели», а не «нет». В
     сводке его быть не должно вовсе. */
  const rows = summarizeAvailability([{ fuel: "AI92", state: "YES", createdAt: ago(10) }], NOW)
  assert.equal(rows.some((row) => row.fuel === "AI98"), false)
})

test("очередь берётся худшая из свежих", () => {
  /* Человек в хвосте сообщает, заправившийся сразу молчит. Занизить
     очередь хуже: во втором случае человек приедет готовым ждать. */
  const rows = summarizeAvailability([
    { fuel: "AI92", state: "YES", queue: "NONE", createdAt: ago(30) },
    { fuel: "AI92", state: "YES", queue: "BIG", createdAt: ago(20) },
  ], NOW)
  assert.equal(rows[0].queue, "BIG")
})

test("у «нет» очереди не бывает", () => {
  // Стоять не за чем.
  const rows = summarizeAvailability([
    { fuel: "AI92", state: "NO", queue: "BIG", createdAt: ago(10) },
  ], NOW)
  assert.equal(rows[0].queue, null)
})

test("мусор в отметках не роняет сводку", () => {
  const rows = summarizeAvailability([
    { fuel: "ЧТО-ТО", state: "YES", createdAt: ago(10) },
    { fuel: "AI92", state: "ВОЗМОЖНО", createdAt: ago(10) },
    { fuel: "AI92", state: "YES", createdAt: ago(10) },
  ], NOW)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].fuel, "AI92")
})

test("возраст отметки читается словами", () => {
  assert.equal(formatAge(ago(0), NOW), "только что")
  assert.equal(formatAge(ago(20), NOW), "20 мин назад")
  assert.equal(formatAge(ago(150), NOW), "2 ч назад")
  assert.equal(formatAge(ago(60 * 26), NOW), "вчера")
  assert.equal(formatAge(null, NOW), null)
})

test("свежесть отделяет сведение от воспоминания", () => {
  // Шестичасовое «есть» — сведение, вчерашнее — воспоминание.
  assert.equal(isFresh(ago(60), NOW), true)
  assert.equal(isFresh(ago(60 * 7), NOW), false)
  assert.equal(isFresh(null, NOW), false)
})

// === Устройство маршрута и карты ===

test("отметка наличия не заменяет прежнюю, а добавляется", () => {
  /* У цены голос один и уточняется, а у наличия накопление подтверждений
     и есть суть: «есть 92, отметили пятеро» весит больше одной отметки. */
  const route = readFileSync(new URL("../src/app/api/fuel-availability/route.ts", import.meta.url), "utf8")
  assert.doesNotMatch(route, /updateMany/)
  assert.match(route, /fuelAvailabilityReport\.create/)
})

test("анонимные отметки ограничены строже", () => {
  // Накрутка с одного адреса красит карту целиком.
  const route = readFileSync(new URL("../src/app/api/fuel-availability/route.ts", import.meta.url), "utf8")
  assert.match(route, /userId\s*\n?\s*\?\s*\{ windowMs: 60 \* 60 \* 1_000, maxRequests: 40 \}/)
  assert.match(route, /maxRequests: 10/)
})

test("адрес не хранится, только его хеш", () => {
  const route = readFileSync(new URL("../src/app/api/fuel-availability/route.ts", import.meta.url), "utf8")
  assert.match(route, /createHash\("sha256"\)/)
})

test("очередь сохраняется только при «есть»", () => {
  // Стоять не за чем.
  const route = readFileSync(new URL("../src/app/api/fuel-availability/route.ts", import.meta.url), "utf8")
  assert.match(route, /queue: state === "YES" \? queue : null/)
})

test("наличие показывается выше цены", () => {
  /* В дефицит человек ищет не «где дешевле», а «где вообще есть». */
  const page = readFileSync(new URL("../src/app/services/fuel-map/page.tsx", import.meta.url), "utf8")
  const availabilityAt = page.indexOf("<FuelAvailabilityReporter")
  const priceAt = page.indexOf("<FuelPriceReporter")
  assert.ok(availabilityAt > 0 && priceAt > 0)
  assert.ok(availabilityAt < priceAt, "наличие должно идти раньше цены")
})
