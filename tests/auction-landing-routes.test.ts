import assert from "node:assert/strict"
import test from "node:test"
import { uniqueAuctionLandingsByPath } from "../src/lib/auction-landing-paths.mjs"

test("разные написания марки дают один адрес посадочной страницы", () => {
  const landings = uniqueAuctionLandingsByPath([
    { countrySlug: "koreya", makeSlug: "mini", make: "MINI", total: 12 },
    { countrySlug: "koreya", makeSlug: "mini", make: "Mini", total: 8 },
    { countrySlug: "yaponiya", makeSlug: "mini", make: "MINI", total: 6 },
  ])

  assert.deepEqual(landings, [
    { countrySlug: "koreya", makeSlug: "mini", make: "MINI", total: 12 },
    { countrySlug: "yaponiya", makeSlug: "mini", make: "MINI", total: 6 },
  ])
})

test("представителем адреса становится группа с наибольшим числом лотов", () => {
  const landings = uniqueAuctionLandingsByPath([
    { countrySlug: "yaponiya", makeSlug: "toyota", make: "TOYOTA", total: 5 },
    { countrySlug: "yaponiya", makeSlug: "toyota", make: "Toyota", total: 40 },
  ])

  assert.equal(landings.length, 1)
  assert.equal(landings[0]?.make, "Toyota")
  assert.equal(landings[0]?.total, 40)
})
