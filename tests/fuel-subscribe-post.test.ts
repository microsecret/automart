import assert from "node:assert/strict"
import test from "node:test"
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { buildFuelSubscribePost } from "../src/lib/fuel-subscribe-post.ts"

const BASE = { city: "Уфа", siteUrl: "https://lewheel.ru", botUsername: "lewheelbot" }

test("марки вынесены кнопками с готовым фильтром", () => {
  /* Человек в чате не выбирает «подписаться вообще» — он ездит на
     девяносто пятом. Кнопка открывает карту сразу с этой маркой, где
     подписка заводится следующим касанием. */
  const post = buildFuelSubscribePost(BASE)
  const urls = post.buttons.flat().map((button) => button.url)

  assert.ok(urls.some((url) => url.includes("fuel=") && url.includes("95")))
  assert.ok(urls.some((url) => url.includes("%D0%94%D0%A2")), "ДТ должен быть среди марок")
})

test("марки идут рядами, а не столбиком", () => {
  /* Пять кнопок в столбик занимают полэкрана телефона и оттесняют текст
     поста за сгиб. */
  const post = buildFuelSubscribePost(BASE)
  const fuelRows = post.buttons.filter((row) => row.every((button) => button.text.startsWith("🔔")))

  assert.ok(fuelRows.length >= 2, "марки должны занимать несколько рядов")
  assert.ok(fuelRows.every((row) => row.length <= 3), "в ряду не больше трёх кнопок")
})

test("числа показываются, только когда есть чем хвалиться", () => {
  /* «3 заправки на карте» отпугивает сильнее молчания: человек видит
     пустой сервис и не возвращается. */
  const small = buildFuelSubscribePost({ ...BASE, stationCount: 3 })
  assert.doesNotMatch(small.text, /3 заправок/)

  const big = buildFuelSubscribePost({ ...BASE, stationCount: 417, pricedCount: 375 })
  assert.match(big.text, /417 заправок/)
  assert.match(big.text, /375 с ценами/)
})

test("обещания совпадают с тем, что делает сервис", () => {
  /* Каждое проверяется по коду: рассылка подписчикам ограничена часом
     (FuelSubscribeButton), вход через Telegram действительно без пароля.
     Обещание, которого не выполняют, обходится дороже несделанного. */
  const post = buildFuelSubscribePost(BASE)

  assert.match(post.text, /не чаще раза в час/i)
  assert.match(post.text, /без пароля и почты/i)
})

test("разметка не ломается на чужом городе", () => {
  const post = buildFuelSubscribePost({ ...BASE, city: "<b>Уфа</b>", stationCount: 100 })
  assert.match(post.text, /&lt;b&gt;/)
})
