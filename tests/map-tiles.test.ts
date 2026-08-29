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

test("все источники законные", () => {
  /* Плитки Яндекса и 2ГИС быстрее и подробнее, но их адреса внутренние:
     в документации не описаны, лицензией не разрешены, и доступ могут
     закрыть в любой день. Ставить сервис в зависимость от чужого
     недосмотра нельзя. */
  for (const source of TILE_SOURCES) {
    assert.doesNotMatch(source.url, /yandex|2gis/i, `${source.id} использует чужой закрытый источник`)
  }
})

test("источников хватает, чтобы карта не осталась без вида", () => {
  assert.ok(TILE_SOURCES.length >= 3)
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

test("источник по умолчанию работает в браузере без ключа", () => {
  /* CARTO отдаёт плитки серверу, но браузеру с чужого домена подсовывает
     картинку «API KEY REQUIRED» — карта была заклеена этой надписью на
     живом сайте. Проверка curl этого не ловит: там ключ не спрашивают. */
  const source = findTileSource(null)
  assert.match(source.url, /tile\.openstreetmap\.org/)
})

test("у карты есть запасные виды", () => {
  assert.ok(TILE_SOURCES.length >= 4)
})
