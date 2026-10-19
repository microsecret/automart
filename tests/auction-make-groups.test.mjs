import assert from "node:assert/strict"
import test from "node:test"
import { auctionMakeKey, groupAuctionMakes } from "../src/lib/auction-make-groups.mjs"

test("combines case variants, sums counts and keeps the most common spelling", () => {
  assert.deepEqual(groupAuctionMakes([
    { make: "Toyota", count: 760 }, { make: "TOYOTA", count: 89 },
    { make: "Honda", count: 160 }, { make: "HONDA", count: 111 },
  ]), [{ make: "Toyota", count: 849 }, { make: "Honda", count: 271 }])
})

test("aggregates the complete distribution before selecting top brands", () => {
  const rows = Array.from({ length: 8 }, (_, i) => ({ make: `Brand${i}`, count: 10 }))
  rows.push({ make: "Toyota", count: 9 }, { make: "TOYOTA", count: 9 })
  const result = groupAuctionMakes(rows)
  assert.equal(result.length, 8)
  assert.deepEqual(result[0], { make: "TOYOTA", count: 18 })
  assert.deepEqual(result, groupAuctionMakes([...rows].reverse()))
})

test("does not merge distinct makes or mutate source data", () => {
  const rows = Object.freeze([
    Object.freeze({ make: "Toyota", count: 2 }),
    Object.freeze({ make: "Toyota Trucks", count: 1 }),
    Object.freeze({ make: "  ", count: 99 }),
  ])
  assert.equal(groupAuctionMakes(rows).length, 2)
  assert.equal(auctionMakeKey(" HONDA "), auctionMakeKey("Honda"))
  assert.deepEqual(groupAuctionMakes([]), [])
})
