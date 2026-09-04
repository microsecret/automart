import assert from "node:assert/strict"
import test from "node:test"
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { buildFuelCardSvg, cardLines, trimCityFromAddress, clamp, formatPrice, escapeSvg, CARD_WIDTH } from "../src/lib/fuel-appeared-card.ts"

test("название заправки не ломает картинку", () => {
  /* Названия приходят от внешних источников, и «Лукойл & Ко» делает
     разметку недопустимой: картинка не отрисуется вовсе, а сообщение
     уйдёт без неё и без объяснений. */
  const svg = buildFuelCardSvg({
    fuels: ["АИ-95"],
    stationName: 'Лукойл & Ко <script>alert("x")</script>',
    address: "ул. Мира, 1",
    city: "Уфа",
  })

  assert.ok(!svg.includes("<script>"))
  assert.ok(svg.includes("&amp;"))
})

test("город не называется дважды", () => {
  /* Источники пишут «Уфа, Сельская Богородская улица, 2/3», а город идёт
     отдельной строкой: выходило «Уфа» дважды, и вторая строка не несла
     ничего. */
  assert.equal(trimCityFromAddress("Уфа, Сельская Богородская улица, 2/3", "Уфа"), "Сельская Богородская улица, 2/3")
  assert.equal(trimCityFromAddress("Сельская улица, 2, Уфа", "Уфа"), "Сельская улица, 2")
  assert.equal(trimCityFromAddress("Уфимская улица, 5", "Уфа"), "Уфимская улица, 5")
})

test("строк ровно столько, сколько есть сведений", () => {
  /* Пустая строка на месте отсутствующего адреса оставляла в карточке
     дыру: раскладка считается от числа строк, а не от заранее назначенных
     высот. */
  const withAddress = cardLines({ fuels: ["АИ-95"], stationName: "Башнефть", address: "ул. Мира, 1", city: "Уфа" })
  const without = cardLines({ fuels: ["АИ-95"], stationName: "Башнефть", address: null, city: "Уфа" })

  assert.equal(withAddress.length, 3)
  assert.equal(without.length, 2)
})

test("длинное название обрезается, а не уезжает за край", () => {
  /* SVG не переносит текст сам: строка ушла бы за границу картинки и
     пропала без следа. */
  const long = clamp("Автозаправочная станция номер сорок семь на объездной дороге", 30)

  assert.ok(long.length <= 30)
  assert.ok(long.endsWith("…"))
})

test("цена пишется как на табло", () => {
  assert.equal(formatPrice(6190), "61,90 ₽")
  assert.equal(formatPrice(5000), "50,00 ₽")
})

test("без цены разделитель идёт во всю ширину", () => {
  /* Обрезанная посередине линия читалась бы как след от пропавшего
     блока. */
  const withPrice = buildFuelCardSvg({ fuels: ["АИ-95"], stationName: "Башнефть", address: null, city: "Уфа", priceKopecks: 6190 })
  const without = buildFuelCardSvg({ fuels: ["АИ-95"], stationName: "Башнефть", address: null, city: "Уфа" })

  assert.ok(without.includes(`x2="${CARD_WIDTH - 96}"`))
  assert.ok(!withPrice.includes(`x2="${CARD_WIDTH - 96}"`))
  assert.ok(!without.includes("за литр"))
})

test("всё, что рисуется, помещается в картинку", () => {
  /* Текст ниже нижнего края не виден и молча пропадает — а карточка
     уходит в чат на две тысячи человек. */
  const svg = buildFuelCardSvg({
    fuels: ["АИ-92", "АИ-95", "ДТ"],
    stationName: "Башнефть",
    address: "Сельская Богородская улица, 2/3",
    city: "Уфа",
    priceKopecks: 6190,
  })

  const ys = [...svg.matchAll(/ y="(\d+)"/g)].map((match) => Number(match[1]))
  assert.ok(ys.length > 0, "в разметке нет текста")
  for (const y of ys) assert.ok(y < 628, `строка на высоте ${y} не помещается`)

  const xs = [...svg.matchAll(/ x="(\d+)"/g)].map((match) => Number(match[1]))
  for (const x of xs) assert.ok(x <= CARD_WIDTH - 96, `элемент на ${x} выходит за поле`)
})

test("кавычки в адресе экранируются", () => {
  /* Апостроф и кавычка встречаются в адресах и рвут атрибут разметки. */
  assert.equal(escapeSvg(`ул. "Мира" & O'Кей`), "ул. &quot;Мира&quot; &amp; O&apos;Кей")
})

test("город с дефисом вычищается наравне с обычным", () => {
  /* Название приходит из справочника и раньше подставлялось прямо в
     регулярное выражение: «Ростов-на-Дону» читался бы там как набор
     символов, а не как слово. Разбор по запятым от этого свободен. */
  assert.equal(trimCityFromAddress("Ростов-на-Дону, проспект Стачки, 25", "Ростов-на-Дону"), "проспект Стачки, 25")
  assert.equal(trimCityFromAddress("проспект Стачки, 25, Ростов-на-Дону", "Ростов-на-Дону"), "проспект Стачки, 25")
})

test("адрес из одного города не превращается в пустоту", () => {
  /* Пустая строка на месте адреса читается как потерянные данные —
     повторить город честнее. */
  assert.equal(trimCityFromAddress("Уфа", "Уфа"), "Уфа")
})

