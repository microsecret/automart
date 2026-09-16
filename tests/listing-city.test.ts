import assert from "node:assert/strict"
import test from "node:test"
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { matchKnownCity, normalizeListingCity } from "../src/lib/listing-city.ts"

// Все случаи ниже взяты из боевой базы 16 сентября 2026: это ровно те
// шесть локаций, что не совпадали со справочником.

test("точное имя проходит как есть", () => {
  assert.equal(matchKnownCity("Москва"), "Москва")
  assert.equal(matchKnownCity("Набережные Челны"), "Набережные Челны")
})

test("строчная «уфа» узнаётся", () => {
  // Из-за неё два уфимских объявления не находились фильтром: `contains`
  // в SQLite считается с регистром.
  assert.equal(matchKnownCity("уфа"), "Уфа")
  assert.equal(matchKnownCity("  УФА  "), "Уфа")
})

test("«йошкар ола» без дефиса узнаётся", () => {
  assert.equal(matchKnownCity("йошкар ола"), "Йошкар-Ола")
})

test("довесок после запятой отбрасывается", () => {
  assert.equal(matchKnownCity("Давлеканово, Республика Башкортостан"), "Давлеканово")
})

test("из двух городов берётся первый", () => {
  // «Альметьевск, Казань»: машина стоит в первом названном городе,
  // второй продавец приписал по своим соображениям.
  assert.equal(matchKnownCity("Альметьевск, Казань"), "Альметьевск")
})

test("буква ё не мешает узнаванию", () => {
  assert.equal(matchKnownCity("Орел"), matchKnownCity("Орёл"))
})

test("чужой город не выдумывается", () => {
  // «rustavi» — это Рустави в Грузии. Приписать его к российскому
  // справочнику значило бы соврать о том, где стоит машина.
  assert.equal(matchKnownCity("rustavi"), null)
  assert.equal(matchKnownCity("Гафурийский район село красноусольск"), null)
})

test("пустое остаётся пустым", () => {
  assert.equal(matchKnownCity(""), null)
  assert.equal(matchKnownCity("   "), null)
  assert.equal(matchKnownCity(null), null)
  assert.equal(matchKnownCity(undefined), null)
})

test("нераспознанное сохраняется, а не стирается", () => {
  // За «Гафурийский район» стоит живое объявление: стереть строку
  // значит спрятать машину вовсе.
  assert.equal(
    normalizeListingCity("Гафурийский район село красноусольск"),
    "Гафурийский район село красноусольск",
  )
  assert.equal(normalizeListingCity("rustavi"), "rustavi")
})

test("распознанное приводится к справочнику", () => {
  assert.equal(normalizeListingCity("уфа"), "Уфа")
  assert.equal(normalizeListingCity("  йошкар ола "), "Йошкар-Ола")
})

test("пробелы по краям срезаются и у нераспознанного", () => {
  assert.equal(normalizeListingCity("  какой-то хутор  "), "какой-то хутор")
  assert.equal(normalizeListingCity("   "), null)
})
