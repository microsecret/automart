import assert from "node:assert/strict"
import test from "node:test"
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { auctionSourceLabel, AUCTION_SOURCE_LABELS } from "../src/lib/auction-source-labels.ts"

test("площадка называется по-человечески, со страной", () => {
  /* В админке и в кабинете доставок источник печатался кодом: «ENCAR»,
     «BOBAEDREAM», «YOUXINPAI». За ними стоят разные страны, разные правила
     выкупа и разные сроки — а по коду страну не угадать. */
  assert.equal(auctionSourceLabel("ENCAR"), "Encar · Корея")
  assert.equal(auctionSourceLabel("BEFORWARD"), "BeForward · Япония")
})

test("незнакомый источник показывается кодом, а не пустотой", () => {
  /* Новую площадку лучше показать кодом: модератор хотя бы поймёт, что
     данные пришли откуда-то ещё. */
  assert.equal(auctionSourceLabel("NEWSOURCE"), "NEWSOURCE")
  assert.equal(auctionSourceLabel(null), "—")
})

test("у каждой площадки названа страна", () => {
  /* Решение о пошлине и сроках доставки зависит от страны, а не от
     названия площадки: пропустить её значит заставить модератора помнить
     соответствие наизусть. */
  for (const [code, label] of Object.entries(AUCTION_SOURCE_LABELS)) {
    assert.ok(label.includes(" · "), `у ${code} не названа страна: ${label}`)
  }
})
