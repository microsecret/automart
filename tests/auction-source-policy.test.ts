import assert from "node:assert/strict"
import test from "node:test"
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { PublicListingPolicyExcludedError, isCarsensorPriceOnRequest, isPublicListingPolicyExcludedError } from "../src/lib/auction-source-policy.ts"

test("осознанное исключение карточки не маскируется под поломку источника", () => {
  const excluded = new PublicListingPolicyExcludedError("Источник не публикует реальную цену")
  assert.equal(isPublicListingPolicyExcludedError(excluded), true)
  assert.equal(isPublicListingPolicyExcludedError(new Error("HTML изменился")), false)
})

test("CarSensor отличает техническую цену по запросу от настоящей цены", () => {
  assert.equal(isCarsensorPriceOnRequest(999_999_999), true)
  assert.equal(isCarsensorPriceOnRequest(1_850_000), false)
  assert.equal(isCarsensorPriceOnRequest(null), false)
})
