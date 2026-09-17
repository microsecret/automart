import assert from "node:assert/strict"
import test from "node:test"
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { buildFuelPriceDigestPost } from "../src/lib/fuel-price-digest-post.ts"

function network(label: string, priceRub: number, stations = 40) {
  return { label, shortLabel: label.slice(0, 2), color: "#000", textColor: "#fff", priceRub, stations }
}

const base = {
  city: "Уфа",
  fuelLabel: "АИ-95",
  mapUrl: "https://lewheel.ru/services/fuel-map/ufa",
}

test("сводка называет город, марку и дешёвую сеть", () => {
  // Числа из боевой базы по Уфе.
  const post = buildFuelPriceDigestPost({
    ...base,
    networks: [network("Башнефть", 6_705, 108), network("Татнефть", 6_752, 7), network("Лукойл", 6_978, 54)],
  })
  assert.ok(post)
  assert.match(post!, /АИ-95 в городе Уфа/)
  assert.match(post!, /1\. <b>Башнефть<\/b> — 67,05 ₽/)
  assert.match(post!, /108 заправок/)
  assert.match(post!, /lewheel\.ru\/services\/fuel-map\/ufa/)
})

test("склонение заправок верное", () => {
  const post = buildFuelPriceDigestPost({
    ...base,
    networks: [network("Башнефть", 6_705, 1), network("Татнефть", 6_752, 3), network("Лукойл", 6_978, 11)],
  })
  assert.match(post!, /1 заправка/)
  assert.match(post!, /3 заправки/)
  assert.match(post!, /11 заправок/)
})

test("показываются только три сети", () => {
  const post = buildFuelPriceDigestPost({
    ...base,
    networks: [
      network("А", 6_700), network("Б", 6_800), network("В", 6_900),
      network("Г", 7_000), network("Д", 7_100),
    ],
  })
  assert.match(post!, /3\. <b>В<\/b>/)
  assert.doesNotMatch(post!, /<b>Г<\/b>/)
})

test("разброс называется, когда он ощутим", () => {
  const post = buildFuelPriceDigestPost({
    ...base,
    networks: [network("Башнефть", 6_705), network("Татнефть", 6_900), network("Лукойл", 7_400)],
  })
  assert.match(post!, /Разница по городу — до 6,95 ₽ на литре/)
})

test("копеечный разброс не упоминается", () => {
  // «Экономия 40 копеек» звучит как насмешка над тем, кто поедет через
  // весь город.
  const post = buildFuelPriceDigestPost({
    ...base,
    networks: [network("Башнефть", 6_705), network("Татнефть", 6_745)],
  })
  assert.doesNotMatch(post!, /Разница по городу/)
})

test("по одной сети сводка не отправляется", () => {
  // Это не сравнение, а реклама: человеку не с чем сопоставить.
  assert.equal(buildFuelPriceDigestPost({ ...base, networks: [network("Лукойл", 6_978)] }), null)
  assert.equal(buildFuelPriceDigestPost({ ...base, networks: [] }), null)
})

test("разметка в названии сети экранируется", () => {
  // Названия приходят из источников: «AMP&CO» сломал бы разбор HTML на
  // стороне Telegram, и сообщение не ушло бы вовсе.
  const post = buildFuelPriceDigestPost({
    ...base,
    networks: [network("AMP&CO", 6_700), network("<Трасса>", 6_800)],
  })
  assert.match(post!, /AMP&amp;CO/)
  assert.match(post!, /&lt;Трасса&gt;/)
  assert.doesNotMatch(post!, /<Трасса>/)
})

test("ровные рубли пишутся без копеек", () => {
  const post = buildFuelPriceDigestPost({
    ...base,
    networks: [network("Башнефть", 6_700), network("Лукойл", 7_000)],
  })
  assert.match(post!, /— 67 ₽/)
  assert.match(post!, /— 70 ₽/)
})

test("блоки разделены пустой строкой", () => {
  /* Увидел на предпросмотре живого текста: `filter(Boolean)` выбрасывал
     пустые строки-разделители вместе с необязательным блоком, и
     заголовок слипался со списком. Тесты на содержимое этого не
     замечали — проверять надо и промежутки. */
  const post = buildFuelPriceDigestPost({
    ...base,
    networks: [network("Башнефть", 6_705), network("Татнефть", 6_900), network("Лукойл", 7_400)],
  })!
  const blocks = post.split("\n\n")
  assert.equal(blocks.length, 4, "заголовок, список, разброс и ссылка")
  assert.match(blocks[0], /в городе Уфа/)
  assert.match(blocks[1], /^1\./)
  assert.match(blocks[2], /Разница по городу/)
  assert.match(blocks[3], /Все заправки на карте/)
})

test("без строки о разбросе ссылка не прилипает к списку", () => {
  // Московский случай: разброс 31 копейка, строки о нём нет.
  const post = buildFuelPriceDigestPost({
    ...base,
    city: "Москва",
    networks: [network("Роснефть", 7_135), network("Татнефть", 7_159), network("Teboil", 7_166)],
  })!
  const blocks = post.split("\n\n")
  assert.equal(blocks.length, 3, "заголовок, список и ссылка")
  assert.match(blocks[2], /Все заправки на карте/)
})
