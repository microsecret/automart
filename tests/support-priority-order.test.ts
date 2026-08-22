import assert from "node:assert/strict"
import test from "node:test"
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { PRIORITY_ORDER, planPriorityPage, priorityRank } from "../src/lib/support-priority-order.ts"

test("важность выстраивается от срочной к низкой", () => {
  assert.deepEqual([...PRIORITY_ORDER], ["URGENT", "HIGH", "NORMAL", "LOW"])
})

test("важное обращение стоит выше низкоприоритетного", () => {
  // Сортировка по убыванию строки давала URGENT → NORMAL → LOW → HIGH:
  // HIGH оказывался ниже LOW, потому что «H» меньше «L».
  assert.ok(priorityRank("HIGH") < priorityRank("LOW"))
  assert.ok(priorityRank("HIGH") < priorityRank("NORMAL"))
  assert.ok(priorityRank("URGENT") < priorityRank("HIGH"))
})

test("незнакомая важность уходит вниз", () => {
  assert.equal(priorityRank("WHATEVER"), PRIORITY_ORDER.length)
})

test("первая страница берёт самые срочные", () => {
  const plan = planPriorityPage({ URGENT: 3, HIGH: 5, NORMAL: 100, LOW: 2 }, 0, 10)
  assert.deepEqual(plan, [
    { priority: "URGENT", skip: 0, take: 3 },
    { priority: "HIGH", skip: 0, take: 5 },
    { priority: "NORMAL", skip: 0, take: 2 },
  ])
})

test("вторая страница продолжает с того же места", () => {
  // Границы страниц не должны рвать группу: на первой взяли два NORMAL,
  // на второй продолжаем с третьего.
  const plan = planPriorityPage({ URGENT: 3, HIGH: 5, NORMAL: 100, LOW: 2 }, 10, 10)
  assert.deepEqual(plan, [{ priority: "NORMAL", skip: 2, take: 10 }])
})

test("пустые группы пропускаются без запроса", () => {
  const plan = planPriorityPage({ URGENT: 0, HIGH: 0, NORMAL: 4, LOW: 1 }, 0, 10)
  assert.deepEqual(plan, [
    { priority: "NORMAL", skip: 0, take: 4 },
    { priority: "LOW", skip: 0, take: 1 },
  ])
})

test("страница за пределами списка пуста", () => {
  assert.deepEqual(planPriorityPage({ URGENT: 2, NORMAL: 3 }, 100, 10), [])
})

test("границы группы совпадают с границей страницы", () => {
  // Ровно пять срочных и страница на пять: вторая страница начинается
  // со следующей группы, а не с шестого срочного, которого нет.
  assert.deepEqual(planPriorityPage({ URGENT: 5, HIGH: 4 }, 5, 5), [{ priority: "HIGH", skip: 0, take: 4 }])
})

test("незнакомая важность попадает в конец выборки", () => {
  const plan = planPriorityPage({ URGENT: 1, WHATEVER: 2 }, 0, 10)
  assert.deepEqual(plan, [
    { priority: "URGENT", skip: 0, take: 1 },
    { priority: "WHATEVER", skip: 0, take: 2 },
  ])
})

test("нулевая страница ничего не запрашивает", () => {
  assert.deepEqual(planPriorityPage({ URGENT: 5 }, 0, 0), [])
})
