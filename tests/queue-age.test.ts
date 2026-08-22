import assert from "node:assert/strict"
import test from "node:test"
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { compareByUrgency, formatQueueAge, hoursSince, queueUrgency } from "../src/lib/queue-age.ts"

const NOW = new Date("2026-08-22T12:00:00Z")
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 60 * 60 * 1000)

test("возраст считается в целых часах", () => {
  assert.equal(hoursSince(hoursAgo(5), NOW), 5)
  assert.equal(hoursSince(hoursAgo(0.5), NOW), 0)
  assert.equal(hoursSince(hoursAgo(49), NOW), 49)
})

test("пустая очередь не имеет возраста", () => {
  assert.equal(hoursSince(null, NOW), null)
  assert.equal(hoursSince(undefined, NOW), null)
})

test("дата из будущего не даёт отрицательный возраст", () => {
  // Повреждённые данные не должны показывать «минус три часа».
  const future = new Date(NOW.getTime() + 3 * 60 * 60 * 1000)
  assert.equal(hoursSince(future, NOW), null)
})

test("срочность растёт с возрастом", () => {
  assert.equal(queueUrgency(2), "fresh")
  assert.equal(queueUrgency(23), "fresh")
  assert.equal(queueUrgency(24), "warning", "сутки — уже требует внимания")
  assert.equal(queueUrgency(71), "warning")
  assert.equal(queueUrgency(72), "critical", "трое суток — просрочено")
  assert.equal(queueUrgency(500), "critical")
})

test("пустая очередь не считается срочной", () => {
  assert.equal(queueUrgency(null), "fresh")
})

test("возраст читается словами", () => {
  assert.equal(formatQueueAge(0), "меньше часа")
  assert.equal(formatQueueAge(1), "1 час")
  assert.equal(formatQueueAge(3), "3 часа")
  assert.equal(formatQueueAge(7), "7 часов")
  assert.equal(formatQueueAge(24), "1 день")
  assert.equal(formatQueueAge(50), "2 дня")
  assert.equal(formatQueueAge(24 * 7), "7 дней")
  assert.equal(formatQueueAge(null), null)
})

test("склонение работает на числах-исключениях", () => {
  // 11-14 склоняются не как 1-4: «11 часов», а не «11 час».
  assert.equal(formatQueueAge(11), "11 часов")
  assert.equal(formatQueueAge(21), "21 час")
  assert.equal(formatQueueAge(24 * 11), "11 дней")
  assert.equal(formatQueueAge(24 * 21), "21 день")
})

test("наверх очереди попадает то, что ждёт дольше", () => {
  // Раньше сортировка шла по величине счётчика: наверх попадало то, чего
  // просто больше. Одна задача возрастом неделю важнее пяти возрастом час.
  const items = [
    { name: "жалобы", oldestHours: 2 },
    { name: "модерация", oldestHours: 168 },
    { name: "партнёры", oldestHours: null },
    { name: "заявки", oldestHours: 30 },
  ]
  const sorted = [...items].sort(compareByUrgency).map((item) => item.name)
  assert.deepEqual(sorted, ["модерация", "заявки", "жалобы", "партнёры"])
})

test("пустые очереди уходят вниз", () => {
  const items = [{ oldestHours: null }, { oldestHours: 1 }]
  assert.equal(items.sort(compareByUrgency)[0].oldestHours, 1)
})
