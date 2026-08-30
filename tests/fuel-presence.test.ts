import assert from "node:assert/strict"
import test from "node:test"
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { decidePresencePrompt, isSameStop, presencePromptText, PRESENCE_MINUTES } from "../src/lib/fuel-presence.ts"

const NOW = new Date("2026-08-31T12:00:00Z")
const minutesAgo = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000)

test("проехал мимо — не спрашиваем", () => {
  /* Светофор у заправки, поворот на парковку, короткая остановка: за две
     минуты человек не заправлялся и о ценах ничего не знает. */
  const decision = decidePresencePrompt(
    { stationId: "a", arrivedAt: minutesAgo(2), seenAt: minutesAgo(1), promptedAt: null },
    NOW,
  )
  assert.equal(decision.action, "wait")
})

test("простоял достаточно — спрашиваем", () => {
  // Заправка занимает пять-семь минут вместе с очередью.
  const decision = decidePresencePrompt(
    { stationId: "a", arrivedAt: minutesAgo(PRESENCE_MINUTES + 1), seenAt: minutesAgo(1), promptedAt: null },
    NOW,
  )
  assert.equal(decision.action, "ask")
})

test("второй раз о той же заправке не спрашиваем", () => {
  /* Человек уже решил, отвечать ему или нет. Повтор читается как
     навязчивость, и трансляцию он выключит совсем. */
  const decision = decidePresencePrompt(
    { stationId: "a", arrivedAt: minutesAgo(40), seenAt: minutesAgo(1), promptedAt: minutesAgo(30) },
    NOW,
  )
  assert.equal(decision.action, "skip")
  assert.equal(decision.action === "skip" && decision.reason, "already-asked")
})

test("через сутки о той же заправке спросить можно", () => {
  // Он приехал заново, и цены с прошлого раза могли смениться.
  const decision = decidePresencePrompt(
    { stationId: "a", arrivedAt: minutesAgo(20), seenAt: minutesAgo(1), promptedAt: minutesAgo(60 * 24) },
    NOW,
  )
  assert.equal(decision.action, "ask")
})

test("протухшая точка не считается", () => {
  /* Трансляция обновляется раз в минуту-две. Полчаса тишины — человек её
     выключил или уехал вне зоны, и старая точка врёт. */
  const decision = decidePresencePrompt(
    { stationId: "a", arrivedAt: minutesAgo(90), seenAt: minutesAgo(45), promptedAt: null },
    NOW,
  )
  assert.equal(decision.action, "skip")
  assert.equal(decision.action === "skip" && decision.reason, "stale")
})

test("переезд на соседнюю заправку обнуляет отсчёт", () => {
  // На прежней он не стоял, и спрашивать о ней поздно.
  assert.equal(isSameStop("a", "a"), true)
  assert.equal(isSameStop("a", "b"), false)
  assert.equal(isSameStop(null, "a"), false)
})

test("приглашение говорит, что нужно и зачем", () => {
  /* Человек занят: одно предложение о деле и одно о том, почему это
     стоит его тридцати секунд. */
  const text = presencePromptText("Башнефть на Ленина")
  assert.ok(text.includes("Башнефть на Ленина"), "нет названия заправки")
  assert.ok(text.includes("тридцать секунд"), "не сказано, сколько это займёт")
  assert.ok(!text.includes("уважаемый"), "канцелярит")
  assert.ok(text.length < 400, "слишком длинно для человека за рулём")
})

test("ждать осталось столько, сколько осталось", () => {
  const decision = decidePresencePrompt(
    { stationId: "a", arrivedAt: minutesAgo(5), seenAt: minutesAgo(1), promptedAt: null },
    NOW,
  )
  assert.equal(decision.action, "wait")
  assert.equal(decision.action === "wait" && decision.minutesLeft, PRESENCE_MINUTES - 5)
})
