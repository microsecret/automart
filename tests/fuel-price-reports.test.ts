import assert from "node:assert/strict"
import test from "node:test"
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { buildConsensusPrices, formatReportedPrice, isFuelReportType, parseReportedPrice } from "../src/lib/fuel-price-reports.ts"

const hoursAgo = (hours: number) => new Date(Date.now() - hours * 60 * 60 * 1_000)

test("accepts prices written with a comma or a dot", () => {
  assert.equal(parseReportedPrice("58,40"), 5_840)
  assert.equal(parseReportedPrice("58.40"), 5_840)
  assert.equal(parseReportedPrice(58.4), 5_840)
  assert.equal(formatReportedPrice(5_840), "58,40")
})

test("rejects prices outside the plausible retail range", () => {
  assert.equal(parseReportedPrice("5"), null)
  assert.equal(parseReportedPrice("999"), null)
  assert.equal(parseReportedPrice("abc"), null)
  assert.equal(parseReportedPrice(null), null)
})

test("validates the fuel type against the published list", () => {
  assert.equal(isFuelReportType("AI95"), true)
  assert.equal(isFuelReportType("AI93"), false)
  assert.equal(isFuelReportType(42), false)
})

test("agrees on the median price and counts confirmations", () => {
  const consensus = buildConsensusPrices([
    { fuel: "AI95", priceRub: 5_840, createdAt: hoursAgo(2) },
    { fuel: "AI95", priceRub: 5_850, createdAt: hoursAgo(5) },
    { fuel: "AI95", priceRub: 5_830, createdAt: hoursAgo(9) },
  ])
  assert.equal(consensus.length, 1)
  assert.equal(consensus[0].priceKopecks, 5_840)
  assert.equal(consensus[0].confirmations, 3)
  assert.equal(consensus[0].label, "АИ-95")
})

test("keeps a typo from becoming the published price", () => {
  // Одна отметка с потерянным разрядом не должна перетягивать цену.
  const consensus = buildConsensusPrices([
    { fuel: "AI92", priceRub: 5_420, createdAt: hoursAgo(1) },
    { fuel: "AI92", priceRub: 5_430, createdAt: hoursAgo(2) },
    { fuel: "AI92", priceRub: 54_200, createdAt: hoursAgo(3) },
  ])
  assert.equal(consensus[0].priceKopecks, 5_430)
  assert.equal(consensus[0].confirmations, 2, "выброс не считается подтверждением")
})

test("ignores stale reports so the map never shows an old price as current", () => {
  const consensus = buildConsensusPrices([
    { fuel: "DT", priceRub: 6_100, createdAt: hoursAgo(24 * 30) },
  ])
  assert.deepEqual(consensus, [])
})

test("reports each fuel separately and skips unknown types", () => {
  const consensus = buildConsensusPrices([
    { fuel: "AI92", priceRub: 5_400, createdAt: hoursAgo(1) },
    { fuel: "DT", priceRub: 6_200, createdAt: hoursAgo(1) },
    { fuel: "AI93", priceRub: 5_500, createdAt: hoursAgo(1) },
  ])
  assert.deepEqual(consensus.map((price) => price.fuel), ["AI92", "DT"])
})

test("reports the freshest confirming timestamp", () => {
  const recent = hoursAgo(1)
  const consensus = buildConsensusPrices([
    { fuel: "GAS", priceRub: 2_500, createdAt: hoursAgo(30) },
    { fuel: "GAS", priceRub: 2_510, createdAt: recent },
  ])
  assert.equal(consensus[0].updatedAt, recent.toISOString())
})
