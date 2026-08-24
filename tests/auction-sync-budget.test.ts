import assert from "node:assert/strict"
import test from "node:test"
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { auctionSourceStageBudgetExceeded, auctionSourceStageStatus, remainingAuctionSourceItems } from "../src/lib/auction-sync-budget.ts"
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { boundedSourceAttemptTimeout } from "../src/lib/authorized-source-http.ts"

test("делит оставшийся общий дедлайн между транспортами без умножения timeout", () => {
  assert.equal(boundedSourceAttemptTimeout(25_000, 3), 8_333)
  assert.equal(boundedSourceAttemptTimeout(16_667, 2), 8_333)
  assert.equal(boundedSourceAttemptTimeout(8_334, 1), 8_334)
  assert.equal(boundedSourceAttemptTimeout(0, 1), 0)
})

test("stage оставляет минуту запаса до внешнего четырёхминутного curl", () => {
  const started = 1_000_000
  assert.equal(auctionSourceStageBudgetExceeded(started, started + 179_999), false)
  assert.equal(auctionSourceStageBudgetExceeded(started, started + 180_000), true)
})

test("отложенный хвост никогда не становится отрицательным", () => {
  assert.equal(remainingAuctionSourceItems(25, 7), 18)
  assert.equal(remainingAuctionSourceItems(3, 8), 0)
})

test("отложенный хвост и частичная обработка не изображают полный успех", () => {
  assert.equal(auctionSourceStageStatus(2, 0, 6), "PARTIAL")
  assert.equal(auctionSourceStageStatus(3, 3, 5), "FAILED")
  assert.equal(auctionSourceStageStatus(4, 2, 4), "PARTIAL")
  assert.equal(auctionSourceStageStatus(4, 0, 0), "SUCCEEDED")
})
