import assert from "node:assert/strict"
import test from "node:test"
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { buildFuelAppearedPost } from "../src/lib/fuel-appeared-post.ts"
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { cityFromChatTitle } from "../src/lib/fuel-invite-post.ts"

const BASE = {
  stationName: "Башнефть",
  address: "Сельская Богородская улица, 2/3",
  city: "Уфа",
  fuelLabels: ["АИ-95"],
  stationId: "osm-node-123456",
  latitude: 54.7351,
  longitude: 55.9587,
  siteUrl: "https://lewheel.ru",
  botUsername: "lewheelbot",
}

test("сообщение отвечает первой строкой", () => {
  /* Чат читают по диагонали. Если ответ не в первой строке, сообщение
     пролистают — а оно и существует ради одного: сказать, что топливо
     появилось там, где его не было. */
  const post = buildFuelAppearedPost(BASE)
  const first = post.text.split("\n")[0]

  assert.match(first, /Появился АИ-95/)
  assert.match(post.text, /Башнефть/)
  assert.match(post.text, /Сельская Богородская/)
})

test("кнопка ведёт на саму заправку, а не на общую карту", () => {
  /* Человек читает про конкретную точку. Общая карта заставила бы искать
     её заново — а координаты нужны, чтобы карта нашла точку, даже если
     открыта на другом городе. */
  const post = buildFuelAppearedPost(BASE)
  const [[watch]] = post.buttons

  assert.match(watch.url, /station=osm-node-123456/)
  assert.match(watch.url, /lat=54\.7351/)
  assert.match(watch.url, /lng=55\.9587/)
})

test("цена показывается, когда её отметили", () => {
  const withPrice = buildFuelAppearedPost({ ...BASE, priceKopecks: 6120 })
  assert.match(withPrice.text, /61,20 ₽/)

  /* Без цены строки быть не должно: пустое «— ₽» выглядит поломкой. */
  assert.doesNotMatch(buildFuelAppearedPost(BASE).text, /₽/)
})

test("несколько подтверждений весомее одного", () => {
  /* Одна отметка и три — разный повод срываться с места, и человек
     должен видеть разницу до того, как поедет. */
  const single = buildFuelAppearedPost(BASE)
  const many = buildFuelAppearedPost({ ...BASE, confirmations: 3 })

  assert.match(single.text, /По отметке водителя/)
  assert.match(many.text, /Подтвердили 3 водителя/)
})

test("разметка не ломается на кавычках в названии", () => {
  /* Названия заправок приходят из источников как есть: «Ирбис» с
     угловыми скобками внутри превратил бы сообщение в сломанный HTML, и
     Telegram отказался бы его принимать целиком. */
  const post = buildFuelAppearedPost({ ...BASE, stationName: 'АЗС <b>"Ирбис"</b> & Ко' })

  assert.match(post.text, /&lt;b&gt;/)
  assert.match(post.text, /&amp; Ко/)
})

test("чаты «Бензин» узнаются наравне с «Авторынком»", () => {
  /* У площадки два семейства чатов: под объявления и под топливо. Пока
     разбор знал только «Авторынок», чаты «Бензин Уфа» и остальные
     считались безымянными и пропускались рассылкой целиком. */
  assert.equal(cityFromChatTitle("Бензин Уфа"), "Уфа")
  assert.equal(cityFromChatTitle("Бензин Казань"), "Казань")
  assert.equal(cityFromChatTitle("Бензин Екатеринбург"), "Екатеринбург")
  assert.equal(cityFromChatTitle("Бензин Москва"), "Москва")
  assert.equal(cityFromChatTitle("АВТОРЫНОК УФА/Башкортостан"), "Уфа")
  /* Общий чат страны города не имеет — сводка «по всей России» никому
     не нужна. */
  assert.equal(cityFromChatTitle("Авторынок России"), null)
})
