import assert from "node:assert/strict"
import test from "node:test"
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { formatEngineVolume, formatMileage, formatPower, formatPriceShort } from "../src/lib/format-numbers.ts"

const NBSP = "\u00a0"

test("цена не разрывается между числом и единицей", () => {
  // В узкой карточке «8,8 млн ₽» с обычным пробелом рвалось на «8,8» и
  // «млн ₽». Цена — то, по чему принимают решение.
  const price = formatPriceShort(8_800_000)
  assert.ok(price.includes(NBSP), `нет неразрывного пробела: ${JSON.stringify(price)}`)
  assert.ok(!/ /.test(price), `остался обычный пробел: ${JSON.stringify(price)}`)
})

test("сокращения написаны по правилам", () => {
  // «тыс.» — с точкой, «млн» — без: сокращение, оканчивающееся
  // согласной, точкой не закрывается.
  assert.match(formatPriceShort(980_000), /тыс\./)
  assert.match(formatPriceShort(8_800_000), /млн(?!\.)/)
})

test("миллионы округляются до десятых, целые — без запятой", () => {
  assert.match(formatPriceShort(4_500_000), /^4,5/)
  assert.match(formatPriceShort(3_000_000), /^3\u00a0млн/)
})

test("пробег не разрывается ни внутри числа, ни перед единицей", () => {
  // «165 000 км» рвалось посередине числа: «165» на одной строке,
  // «000 км» на другой.
  const mileage = formatMileage(165_000)
  assert.ok(!/ /.test(mileage), `остался обычный пробел: ${JSON.stringify(mileage)}`)
  assert.ok(mileage.endsWith(`${NBSP}км`), `единица оторвана: ${JSON.stringify(mileage)}`)
})

test("нулевой пробег показывается, а не прячется", () => {
  // Новая техника действительно «0 км», и это не то же самое, что
  // «пробег неизвестен».
  assert.match(formatMileage(0), /^0/)
})

test("объём двигателя всегда с одним знаком после запятой", () => {
  // «2 л» и «2,0 л» в соседних карточках читаются как разная точность.
  assert.equal(formatEngineVolume(2), `2,0${NBSP}л`)
  assert.equal(formatEngineVolume(1.6), `1,6${NBSP}л`)
})

test("нулевой объём показывается прочерком", () => {
  // Ноль литров у двигателя невозможен — значит, данных нет. Прочерк
  // честнее пустоты: иначе непонятно, данных нет или их не показали.
  assert.equal(formatEngineVolume(0), "—")
  assert.equal(formatEngineVolume(null), "—")
})

test("мощность округляется до целых", () => {
  assert.equal(formatPower(149.6), `150${NBSP}л.с.`)
  assert.equal(formatPower(0), "—")
})

test("отсутствующие значения не выдумываются", () => {
  assert.equal(formatMileage(null), "—")
  assert.equal(formatPriceShort(null), "Договорная")
})
