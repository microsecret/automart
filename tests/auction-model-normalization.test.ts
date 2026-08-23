import assert from "node:assert/strict"
import test from "node:test"
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { deriveAuctionDriveTypeFromText, normalizeAuctionModel } from "../src/lib/auction-normalization.ts"

test("keeps a plain model name untouched", () => {
  assert.equal(normalizeAuctionModel("Palisade"), "Palisade")
  assert.equal(normalizeAuctionModel("Grand Santa Fe"), "Grand Santa Fe")
  assert.equal(normalizeAuctionModel("5 Series"), "5 Series")
  assert.equal(normalizeAuctionModel("C-Class"), "C-Class")
})

test("drops the configuration tail Chinese storefronts put into the model", () => {
  assert.equal(
    normalizeAuctionModel("C-Class 2024 1.5T задний привод Sport экостандарт China VI"),
    "C-Class 2024 1.5T",
  )
  assert.equal(
    normalizeAuctionModel("Civic 2023 1.5T АКПП передний привод Power240TURBO"),
    "Civic 2023 1.5T",
  )
  assert.equal(
    normalizeAuctionModel("A4L юбилейная комплектация Enjoy 2025 2.0T АКПП передний привод"),
    "A4L",
  )
})

test("keeps trim names buyers actually search for", () => {
  // Комплектация — часть запроса покупателя, поэтому она не обрезается.
  for (const value of [
    "Sportage Gasoline 1.6 Turbo 2WD Signature",
    "GV80 2.5T Gasoline AWD",
    "Rexton Diesel 2.2 4WD The Black",
    "X7 xDrive 40d M Sport 6STR",
  ]) {
    assert.equal(normalizeAuctionModel(value), value)
  }
})

test("never returns an empty label for a real model", () => {
  for (const value of ["Ray", "K5", "A4L", "Tucson"]) {
    assert.equal(normalizeAuctionModel(value), value)
  }
})

test("rejects values that stay in an East Asian script", () => {
  assert.equal(normalizeAuctionModel("轿车"), null)
  assert.equal(normalizeAuctionModel(""), null)
  assert.equal(normalizeAuctionModel(null), null)
})

test("bounds an over-long label at a word boundary", () => {
  const normalized = normalizeAuctionModel(
    "Sportage Gasoline Turbo Signature Prestige Exclusive Premium Collection Edition Deluxe",
  )
  assert.ok(normalized)
  assert.ok(normalized.length <= 64, `ожидали не длиннее 64 символов, получили ${normalized.length}`)
  assert.ok(!normalized.endsWith(" "), "обрезка не должна оставлять хвостовой пробел")
  assert.ok(normalized.startsWith("Sportage Gasoline"), "начало названия сохраняется")
})

test("сжимает пересказ переводчика в обозначение модели", () => {
  // Переводчик не всегда держит заданный формат и возвращает название фразой.
  // В карточке она не помещается и не совпадает с поисковым запросом.
  assert.equal(
    normalizeAuctionModel("5-й серии 525Li 2022 модельного года 2.0T автоматическая коробка"),
    "5 Series 525Li 2022 2.0T AT",
  )
  assert.equal(normalizeAuctionModel("H6 2024 года выпуска 1.5T автомат"), "H6 2024 1.5T AT")
})

test("не трогает название, уже собранное словарём", () => {
  assert.equal(normalizeAuctionModel("3 Series 325i 2024 2.0T"), "3 Series 325i 2024 2.0T")
})

test("явный привод из названия источника нормализуется без догадок", () => {
  for (const value of ["X7 xDrive40d", "C 200 4MATIC+", "A6 45 TFSI quattro", "Mohave 4WD"]) {
    assert.equal(deriveAuctionDriveTypeFromText(value), "AWD", value)
  }
  assert.equal(deriveAuctionDriveTypeFromText("Model Y RWD"), "RWD")
  assert.equal(deriveAuctionDriveTypeFromText("EV6 FWD Air"), "FWD")
})

test("неоднозначный 2WD и похожие слова не превращаются в привод", () => {
  assert.equal(deriveAuctionDriveTypeFromText("Sorento 2WD Signature"), null)
  assert.equal(deriveAuctionDriveTypeFromText("Forward Edition"), null)
  assert.equal(deriveAuctionDriveTypeFromText(null), null)
})
