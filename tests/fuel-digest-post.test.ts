import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { buildFuelDigest, MAX_DIGEST_STATIONS } from "../src/lib/fuel-digest-post.ts"

const base = { city: "Казань", siteUrl: "https://lewheel.ru/", botUsername: "lewheelbot", reportsToday: 40 }
const station = { name: "Татнефть, Ямашева 12", fuels: ["92", "95"], priceKopecks: 6310, minutesAgo: 25 }

test("город назван в первой строке", () => {
  /* «Карта АЗС России» человек не примеряет на себя, «где есть топливо в
     Казани» — примеряет. */
  const post = buildFuelDigest({ ...base, stations: [station] })
  assert.match(post.text.split("\n")[0], /Казани|Казань/)
})

test("в списке видно марку, цену и возраст", () => {
  /* «40 минут назад» и «5 часов назад» — разные сведения, без них человек
     поедет по вчерашним. */
  const post = buildFuelDigest({ ...base, stations: [station] })
  assert.match(post.text, /Татнефть/)
  assert.match(post.text, /92, 95/)
  assert.match(post.text, /63,10/)
  assert.match(post.text, /25 мин назад/)
})

test("часы показываются часами, а не минутами", () => {
  const post = buildFuelDigest({ ...base, stations: [{ ...station, minutesAgo: 185 }] })
  assert.match(post.text, /3 ч назад/)
})

test("длинный список обрезается", () => {
  /* В чате сводка конкурирует с разговором: длинный список пролистывают
     целиком. */
  const many = Array.from({ length: 12 }, (_, i) => ({ ...station, name: `АЗС ${i}` }))
  const post = buildFuelDigest({ ...base, stations: many })
  const rows = post.text.split("\n").filter((line) => line.startsWith("✅"))
  assert.equal(rows.length, MAX_DIGEST_STATIONS)
})

test("пустая сводка не зовёт на карту впустую", () => {
  /* Человек откроет и увидит пустоту. Вместо этого просим отметить — так
     честнее, сервис живёт отметками. */
  const post = buildFuelDigest({ ...base, stations: [], reportsToday: 0 })
  assert.match(post.text, /никто не отмечал/)
  assert.match(post.text, /отметьте за две секунды/i)
})

test("маленьким числом отметок не хвастаемся", () => {
  /* «3 отметки» говорит человеку, что сервисом не пользуются. */
  const post = buildFuelDigest({ ...base, stations: [station], reportsToday: 3 })
  assert.doesNotMatch(post.text, /Сегодня отметили/)
})

test("большим числом хвастаемся", () => {
  const post = buildFuelDigest({ ...base, stations: [station], reportsToday: 40 })
  assert.match(post.text, /Сегодня отметили 40 раз/)
})

test("сводка честно предупреждает", () => {
  // Обещать наличие по чужой отметке нельзя, разочарование запомнится.
  const post = buildFuelDigest({ ...base, stations: [station] })
  assert.match(post.text, /могут разобрать/)
})

test("подпись укладывается в предел Telegram", () => {
  const many = Array.from({ length: MAX_DIGEST_STATIONS }, (_, i) => ({
    ...station,
    name: `Газпромнефть, проспект Победы, дом ${i + 100}`,
  }))
  const post = buildFuelDigest({ ...base, stations: many })
  assert.ok(post.text.length <= 1024, `получилось ${post.text.length}`)
})

test("первая кнопка ведёт на карту", () => {
  const post = buildFuelDigest({ ...base, stations: [station] })
  assert.match(post.buttons[0].url, /\/services\/fuel-map/)
})

test("теги в названии заправки экранируются", () => {
  const post = buildFuelDigest({ ...base, stations: [{ ...station, name: "АЗС <b>№1</b>" }] })
  assert.match(post.text, /&lt;b&gt;/)
})

// === Устройство рассылки ===

test("общий чат страны пропускается", () => {
  /* Сводка «по всей России» бессмысленна: человеку нужен его город, а не
     список из семи регионов. */
  const broadcast = readFileSync(new URL("../src/lib/fuel-digest-broadcast.ts", import.meta.url), "utf8")
  assert.match(broadcast, /if \(!city\) \{/)
})

test("сводка уходит раз в сутки", () => {
  const broadcast = readFileSync(new URL("../src/lib/fuel-digest-broadcast.ts", import.meta.url), "utf8")
  assert.match(broadcast, /CHAT_INTERVAL_MS = 20 \* 60 \* 60 \* 1000/)
})

test("в сводку идут настоящие названия, а не коды точек", () => {
  /* Точки живут в OpenStreetMap: без сохранённого названия в сводке
     стоял бы код вида «osm-node-123». */
  const broadcast = readFileSync(new URL("../src/lib/fuel-digest-broadcast.ts", import.meta.url), "utf8")
  assert.match(broadcast, /report\.stationName \|\| "АЗС"/)
  const route = readFileSync(new URL("../src/app/api/fuel-availability/route.ts", import.meta.url), "utf8")
  assert.match(route, /stationName: stationNameRaw/)
})

test("сводка уходит утром, а не вечером", () => {
  /* Время выбрано под дорогу на работу. Вечером она бесполезна: топливо
     к ночи разберут, а утром привезут новое. */
  const cron = readFileSync(new URL("../scripts/install-fuel-digest-cron.sh", import.meta.url), "utf8")
  assert.match(cron, /JOB="5 5 \* \* \*/)
})
