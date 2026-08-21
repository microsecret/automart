import assert from "node:assert/strict"
import test from "node:test"
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { normalizeSavedSearchQuery, savedSearchHref } from "../src/lib/saved-search.ts"

/**
 * Строка приходит с клиента и подставляется в адрес, по которому человек
 * перейдёт из своего же уведомления. Ошибка здесь — способ увести его на
 * чужую страницу.
 */

test("посторонние параметры отбрасываются", () => {
  const query = normalizeSavedSearchQuery("make=BMW&redirect=https://evil.com&callback=x", "LISTINGS")
  assert.ok(query.includes("make=BMW"))
  assert.ok(!query.includes("redirect"), `протащен redirect: ${query}`)
  assert.ok(!query.includes("callback"), `протащен callback: ${query}`)
})

test("параметры аукционов и объявлений не смешиваются", () => {
  // country есть только у аукционов, transmission — только у объявлений.
  assert.ok(normalizeSavedSearchQuery("country=KR", "AUCTIONS").includes("country=KR"))
  assert.equal(normalizeSavedSearchQuery("country=KR", "LISTINGS"), "")
  assert.ok(normalizeSavedSearchQuery("transmission=AUTOMATIC", "LISTINGS").includes("transmission"))
  assert.equal(normalizeSavedSearchQuery("transmission=AUTOMATIC", "AUCTIONS"), "")
})

test("порядок фильтров не меняет подписку", () => {
  const a = normalizeSavedSearchQuery("make=BMW&priceTo=3000000&yearFrom=2018", "LISTINGS")
  const b = normalizeSavedSearchQuery("yearFrom=2018&make=BMW&priceTo=3000000", "LISTINGS")
  assert.equal(a, b, "одинаковые фильтры дали разные строки")
})

test("пустые и слишком длинные значения не сохраняются", () => {
  assert.equal(normalizeSavedSearchQuery("make=&model=   ", "LISTINGS"), "")
  const long = "x".repeat(200)
  assert.equal(normalizeSavedSearchQuery(`q=${long}`, "LISTINGS"), "")
})

test("ведущий вопросительный знак не ломает разбор", () => {
  assert.ok(normalizeSavedSearchQuery("?make=Kia", "LISTINGS").includes("make=Kia"))
})

test("адрес подписки ведёт в свой раздел", () => {
  assert.equal(savedSearchHref("AUCTIONS", "country=KR"), "/auctions?country=KR")
  assert.equal(savedSearchHref("LISTINGS", "make=BMW"), "/?make=BMW")
  assert.equal(savedSearchHref("LISTINGS", ""), "/")
})

test("значения не выходят за пределы своего параметра", () => {
  // Попытка склеить второй параметр внутрь значения должна быть закодирована.
  const query = normalizeSavedSearchQuery("make=BMW%26redirect%3Devil", "LISTINGS")
  assert.ok(!query.includes("&redirect="), `значение вырвалось за границы: ${query}`)
})
