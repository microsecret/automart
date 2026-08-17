import assert from "node:assert/strict"
import test from "node:test"
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { normalizeAuctionModel } from "../src/lib/auction-normalization.ts"

test("keeps a plain model name untouched", () => {
  assert.equal(normalizeAuctionModel("Palisade"), "Palisade")
  assert.equal(normalizeAuctionModel("Grand Santa Fe"), "Grand Santa Fe")
  assert.equal(normalizeAuctionModel("5 Series"), "5 Series")
  assert.equal(normalizeAuctionModel("C-Class"), "C-Class")
})

test("drops the configuration tail Chinese storefronts put into the model", () => {
  assert.equal(
    normalizeAuctionModel("C-Class 2024 1.5T задний привод Sport экостандарт China VI"),
    "C-Class",
  )
  assert.equal(
    normalizeAuctionModel("Civic 2023 1.5T АКПП передний привод Power240TURBO экостандарт China VI"),
    "Civic",
  )
  assert.equal(
    normalizeAuctionModel("5 Series 530Li 2022 2.0T АКПП задний привод рестайлинг Leading, пакет M Sport"),
    "5 Series 530Li",
  )
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

test("bounds an enumeration that survived the tail cut", () => {
  const normalized = normalizeAuctionModel("Model One Two Three Four Five Six Seven")
  assert.equal(normalized?.split(" ").length, 5)
})
