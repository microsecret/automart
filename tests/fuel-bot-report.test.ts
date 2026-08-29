import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { buildAction, distanceKm, formatDistance, matchStation, parseAction } from "../src/lib/fuel-bot-report.ts"

const HERE = { latitude: 54.7351, longitude: 55.9587 }

/** Смещение примерно на metres метров к северу. */
const north = (metres: number) => ({ latitude: HERE.latitude + metres / 111_320, longitude: HERE.longitude })

test("одна заправка рядом — спрашиваем сразу про неё", () => {
  // Лишний вопрос «эта?» при единственном варианте отнимает нажатие.
  const result = matchStation(HERE, [{ id: "osm-node-1", name: "Башнефть", ...north(50) }])
  assert.equal(result.kind, "single")
})

test("несколько рядом — просим выбрать", () => {
  const result = matchStation(HERE, [
    { id: "osm-node-1", name: "Башнефть", ...north(50) },
    { id: "osm-node-2", name: "Лукойл", ...north(120) },
  ])
  assert.equal(result.kind, "choice")
  if (result.kind === "choice") {
    assert.equal(result.stations[0].station.id, "osm-node-1", "ближайшая должна быть первой")
  }
})

test("больше трёх вариантов не предлагаем", () => {
  /* Список из десяти кнопок читается дольше, чем открывается карта, и
     смысл отметки из бота теряется. */
  const stations = [50, 100, 150, 200, 250].map((m, i) => ({
    id: `osm-node-${i + 1}`, name: `АЗС ${i + 1}`, ...north(m),
  }))
  const result = matchStation(HERE, stations)
  assert.equal(result.kind, "choice")
  if (result.kind === "choice") assert.equal(result.stations.length, 3)
})

test("далёкая заправка не считается «той самой»", () => {
  /* Больший радиус привёл бы к отметкам не на той АЗС: за километр их
     обычно несколько. */
  const result = matchStation(HERE, [{ id: "osm-node-9", name: "Далёкая", ...north(900) }])
  assert.equal(result.kind, "none")
})

test("пустой справочник не роняет разбор", () => {
  assert.equal(matchStation(HERE, []).kind, "none")
})

test("нажатие кнопки разбирается обратно", () => {
  const action = { kind: "fuel" as const, stationId: "osm-node-42", fuel: "AI92", state: "YES" as const }
  const parsed = parseAction(buildAction(action))
  assert.deepEqual(parsed, action)
})

test("данные кнопки укладываются в предел Telegram", () => {
  // callback_data ограничен 64 байтами; длинный идентификатор их съедает.
  const data = buildAction({ kind: "fuel", stationId: "osm-relation-1234567890", fuel: "AI100", state: "NO" })
  assert.ok(Buffer.byteLength(data, "utf8") <= 64, `получилось ${Buffer.byteLength(data, "utf8")}`)
})

test("чужая строка в кнопке отбрасывается", () => {
  /* Данные приходят от Telegram, но подделать их может кто угодно, кто
     знает формат: без проверки в базу легла бы отметка на произвольную
     точку. */
  assert.equal(parseAction("f:y:../../etc/passwd:AI92"), null)
  assert.equal(parseAction("что-то другое"), null)
  assert.equal(parseAction("f:y::AI92"), null)
  assert.equal(parseAction(""), null)
})

test("очередь разбирается только из известных значений", () => {
  assert.equal(parseAction("f:q:osm-node-1:BIG")?.kind, "queue")
  assert.equal(parseAction("f:q:osm-node-1:ОГРОМНАЯ"), null)
})

test("расстояние показывается округлённо", () => {
  // «120 м» честнее, чем «117,4 м»: точность геолокации всё равно ниже.
  assert.equal(formatDistance(0.117), "120 м")
  assert.equal(formatDistance(0.004), "10 м")
  assert.equal(formatDistance(1.55), "1,6 км")
})

test("расстояние считается верно", () => {
  assert.ok(Math.abs(distanceKm(HERE, north(1000)) - 1) < 0.01)
})

// === Устройство обработки ===

test("бот понимает нажатия на кнопки", () => {
  /* Раньше callback_query отбрасывался: любая кнопка молча ничего не
     делала, и отметка топлива из бота была невозможна. */
  const webhook = readFileSync(new URL("../src/app/api/telegram/webhook/route.ts", import.meta.url), "utf8")
  assert.match(webhook, /update\.callback_query/)
  assert.match(webhook, /handleFuelCallback/)
})

test("присланная точка ведёт к отметке топлива", () => {
  // Единственный способ отметить, не открывая карту.
  const webhook = readFileSync(new URL("../src/app/api/telegram/webhook/route.ts", import.meta.url), "utf8")
  assert.match(webhook, /handleFuelLocation/)
})

test("точка обрабатывается только в личном чате", () => {
  /* В группе человек шлёт точку не боту, а собеседникам, и вопрос «что
     на этой заправке?» там читался бы как вмешательство. */
  const webhook = readFileSync(new URL("../src/app/api/telegram/webhook/route.ts", import.meta.url), "utf8")
  assert.match(webhook, /chat\?\.type === "private"[\s\S]{0,200}location\?\.latitude/)
})

test("Telegram получает ответ на нажатие сразу", () => {
  // Иначе кнопка крутится у человека до истечения срока.
  const handler = readFileSync(new URL("../src/lib/fuel-bot-handler.ts", import.meta.url), "utf8")
  assert.match(handler, /answerCallbackQuery/)
})

test("в кнопках три ходовые марки, не шесть", () => {
  /* Шесть кнопок в два ряда человек за рулём читает дольше, чем ему
     нужно. */
  const handler = readFileSync(new URL("../src/lib/fuel-bot-handler.ts", import.meta.url), "utf8")
  assert.match(handler, /BOT_FUELS: AvailabilityFuel\[\] = \["AI92", "AI95", "DT"\]/)
})

test("после отметки человек видит сводку", () => {
  // Иначе непонятно, сложилась ли его отметка с чужими или улетела впустую.
  const handler = readFileSync(new URL("../src/lib/fuel-bot-handler.ts", import.meta.url), "utf8")
  assert.match(handler, /summarizeAvailability/)
  assert.match(handler, /editMessageText/)
})

test("отметка из бота будит подписчиков", () => {
  // Появление топлива не зависит от того, откуда пришла отметка.
  const handler = readFileSync(new URL("../src/lib/fuel-bot-handler.ts", import.meta.url), "utf8")
  assert.match(handler, /notifyFuelSubscribers/)
})

test("при регистрации рассказано про карту и просьбу позвать друзей", () => {
  /* Карта наличия работает ровно настолько, насколько людей на ней, и
     объяснить это надо там, где человек понял её пользу для себя. */
  const webhook = readFileSync(new URL("../src/app/api/telegram/webhook/route.ts", import.meta.url), "utf8")
  assert.match(webhook, /где сейчас есть бензин/)
  assert.match(webhook, /Расскажите знакомым автомобилистам/)
})
