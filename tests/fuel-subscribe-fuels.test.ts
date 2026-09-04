import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { AVAILABILITY_FUELS } from "../src/lib/fuel-availability.ts"

const button = readFileSync(new URL("../src/components/fuel/FuelSubscribeButton.tsx", import.meta.url), "utf8")

test("подписаться можно на любую марку, о которой приходят новости", () => {
  /* Список марок в окне подписки был свой, руками, и каждый раз отставал
     от того, о чём в чат уходят сообщения: человек нажимал «сообщать мне
     о таком», открывал окно и своей марки не находил. Так терялись
     сначала сотый и газ, потом АИ-98.

     Теперь список берётся из общего — того же, по которому размечается
     наличие и принимает подписку API. */
  assert.match(button, /SUBSCRIBABLE_FUELS[^=]*=\s*\[\.\.\.AVAILABILITY_FUELS\]/)
})

test("порядок марок назван для всех, что есть", () => {
  /* Порядок задан руками — по распространённости, а не по коду. Марка,
     которой в нём нет, у Array.indexOf получает -1 и уезжает в начало
     списка: газ оказался бы первым, впереди 92-го. */
  const order = button.match(/SUBSCRIBE_ORDER[^=]*=\s*\[([^\]]+)\]/)
  assert.ok(order, "порядок марок не найден")

  const listed = order[1].match(/"([A-Z0-9]+)"/g)?.map((value) => value.replace(/"/g, "")) ?? []
  for (const fuel of AVAILABILITY_FUELS) {
    assert.ok(listed.includes(fuel), `марка ${fuel} не названа в порядке`)
  }
})

test("кнопки марок стоят по три в ряд", () => {
  /* Марок шесть: в одну строку подписи сжимаются до нечитаемых на
     телефоне, в столбик занимают полэкрана. */
  assert.match(button, /<SimpleGrid cols=\{3\}/)
  assert.ok(!/<Group grow/.test(button), "остался растягивающий ряд")
})
