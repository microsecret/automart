import assert from "node:assert/strict"
import test from "node:test"
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { enqueueAppearances, delayUntilNextPost, QUEUE_LIMIT, QUEUE_INTERVAL_MS } from "../src/lib/fuel-appeared-queue.ts"

test("новости прогона встают в очередь, а не теряются", () => {
  /* Прогон по Уфе принёс четыре появления разом. Раньше в чат уходило
     одно — остальные гасил порог; теперь ждут своей минуты все. */
  const queue = enqueueAppearances([], [
    { key: "gdebenz-1", payload: 1 },
    { key: "gdebenz-2", payload: 2 },
    { key: "gdebenz-3", payload: 3 },
    { key: "gdebenz-4", payload: 4 },
  ])

  assert.equal(queue.length, 4)
  assert.deepEqual(queue.map((item) => item.payload), [1, 2, 3, 4])
})

test("та же заправка дважды в очередь не попадает", () => {
  /* Пока сообщение ждёт отправки, второй источник успевает сказать про
     ту же колонку то же самое. В чате это выглядело бы повтором. */
  const first = enqueueAppearances([], [{ key: "gdebenz-1", payload: "ДТ" }])
  const second = enqueueAppearances(first, [{ key: "gdebenz-1", payload: "ДТ" }])

  assert.equal(second.length, 1)
})

test("очередь не растёт бесконечно", () => {
  /* Прогон по всей России способен принести сотни новостей. Слать их
     сутки по одной в минуту бессмысленно: топливо давно разберут. */
  const incoming = Array.from({ length: QUEUE_LIMIT + 15 }, (_, index) => ({
    key: `station-${index}`,
    payload: index,
  }))

  assert.equal(enqueueAppearances([], incoming).length, QUEUE_LIMIT)
})

test("в пустой чат пишем сразу", () => {
  assert.equal(delayUntilNextPost(null, new Date()), 0)
})

test("сразу после сообщения ждём почти минуту", () => {
  /* Ради этого всё и делалось: четыре сообщения ушли в одну секунду,
     потому что порог проверялся раньше, чем предыдущее записывалось. */
  const now = new Date("2026-09-04T15:18:10Z")
  const justPosted = new Date("2026-09-04T15:18:05Z")

  assert.equal(delayUntilNextPost(justPosted, now), 55_000)
})

test("минута прошла — можно писать", () => {
  const now = new Date("2026-09-04T15:19:11Z")
  const before = new Date("2026-09-04T15:18:10Z")

  assert.equal(delayUntilNextPost(before, now), 0)
})

test("часы сервера ушли вперёд — ожидание не уходит в минус", () => {
  /* Запись из будущего подвесила бы отправку навсегда: setTimeout с
     отрицательным значением срабатывает мгновенно, но цикл ожидания
     крутился бы вхолостую. */
  const now = new Date("2026-09-04T15:18:10Z")
  const future = new Date("2026-09-04T15:30:00Z")

  const delay = delayUntilNextPost(future, now)
  assert.ok(delay >= 0)
  assert.ok(delay <= QUEUE_INTERVAL_MS)
})
