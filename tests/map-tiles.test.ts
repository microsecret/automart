import assert from "node:assert/strict"
import test from "node:test"
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { TILE_SOURCES, buildTileUrl, findTileSource } from "../src/lib/map-tiles.ts"

test("адрес плитки собирается из шаблона", () => {
  assert.equal(
    buildTileUrl("https://example.org/{z}/{x}/{y}.png", 13, 4956, 2645),
    "https://example.org/13/4956/2645.png",
  )
})

test("неизвестный источник не оставляет карту пустой", () => {
  /* Значение из хранилища браузера могло остаться от источника, который
     потом убрали: показывать пустоту вместо карты нельзя. */
  const source = findTileSource("такого-нет")
  assert.ok(source.url.startsWith("https://"))
})

test("у каждого источника указан правообладатель", () => {
  // Лицензия OpenStreetMap и CARTO требует указания источника.
  for (const source of TILE_SOURCES) {
    assert.ok(source.attribution.trim().length > 0, `${source.id} без указания источника`)
  }
})

test("источник вне документации помечен", () => {
  /* Адрес плиток Яндекса внутренний: он не описан в документации,
     лицензия такое использование запрещает, и доступ могут закрыть без
     предупреждения. Пометка нужна, чтобы это решение принималось
     осознанно, а не по недосмотру. */
  const yandex = TILE_SOURCES.find((source) => source.id === "yandex")
  assert.ok(yandex)
  assert.equal(yandex.unofficial, true)
})

test("есть источники, которые никто не отберёт", () => {
  /* На случай отключения Яндекса: карта должна остаться рабочей, а не
     умереть в один день вместе с чужим сервером. */
  const official = TILE_SOURCES.filter((source) => !source.unofficial)
  assert.ok(official.length >= 2, "запасных источников должно быть хотя бы два")
})

test("есть тёмный вид карты", () => {
  // Ночью белая карта в машине слепит.
  assert.ok(TILE_SOURCES.some((source) => source.dark))
})

test("все адреса содержат подстановки", () => {
  for (const source of TILE_SOURCES) {
    for (const token of ["{z}", "{x}", "{y}"]) {
      assert.ok(source.url.includes(token), `${source.id} без ${token}`)
    }
  }
})
