import assert from "node:assert/strict"
import test from "node:test"
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { nextFuelMark, keepsPrice } from "../src/lib/fuel-mark-cycle.ts"

test("по марке можно сказать «нет», не трогая остальные", () => {
  /* Главное, ради чего круг и появился: 92-й есть, 95-го нет. Раньше
     отсутствие ставилось только скопом — «нет вообще» гасит все марки
     разом и врёт про 92-й. */
  assert.equal(nextFuelMark(null), "YES")
  assert.equal(nextFuelMark("YES"), "NO")
})

test("третье нажатие снимает ответ", () => {
  /* Ошибиться легко, стоя у колонки одной рукой: круг должен
     возвращаться к пустому, а не запирать человека между «есть» и
     «нет». */
  assert.equal(nextFuelMark("NO"), null)
})

test("круг замкнут и возвращается к началу", () => {
  let mark = null
  const seen = []
  for (let step = 0; step < 3; step += 1) {
    mark = nextFuelMark(mark)
    seen.push(mark)
  }
  assert.deepEqual(seen, ["YES", "NO", null])
})

test("цена держится только у того, что есть", () => {
  /* Цена того, чего нет, — бессмыслица: она осталась бы от прошлого
     нажатия и ушла бы на сервер вместе с «нет». */
  assert.equal(keepsPrice("YES"), true)
  assert.equal(keepsPrice("NO"), false)
  assert.equal(keepsPrice(null), false)
})
