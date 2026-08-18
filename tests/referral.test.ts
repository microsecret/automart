import assert from "node:assert/strict"
import test from "node:test"
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { buildReferralBalance, calculateRewardAmount, nextReferralTier, referralCodeForUser, resolveReferralTier } from "../src/lib/referral.ts"

test("raises the percent as paid invitees accumulate", () => {
  assert.equal(resolveReferralTier(0).percent, 20)
  assert.equal(resolveReferralTier(2).percent, 20)
  assert.equal(resolveReferralTier(3).percent, 30)
  assert.equal(resolveReferralTier(10).percent, 40)
  assert.equal(resolveReferralTier(25).percent, 50)
  assert.equal(resolveReferralTier(500).percent, 50, "выше максимума шкала не растёт")
})

test("tells the partner what is left to the next tier", () => {
  assert.deepEqual(nextReferralTier(0)?.needed, 3)
  assert.deepEqual(nextReferralTier(9)?.needed, 1)
  assert.equal(nextReferralTier(25), null, "на максимуме следующего уровня нет")
})

test("rounds the reward down so the platform never promises more than it owes", () => {
  assert.equal(calculateRewardAmount(1000, 20), 200)
  assert.equal(calculateRewardAmount(999, 30), 299, "299.7 округляется вниз")
  assert.equal(calculateRewardAmount(0, 50), 0)
  assert.equal(calculateRewardAmount(-100, 50), 0, "отрицательный платёж не создаёт долга")
})

test("keeps the referral code stable and non-obvious", () => {
  const code = referralCodeForUser("user-123")
  assert.equal(code, referralCodeForUser("user-123"), "код не меняется между вызовами")
  assert.notEqual(code, referralCodeForUser("user-124"))
  assert.equal(code.length, 8)
  assert.ok(!code.includes("user"), "идентификатор не восстанавливается из кода")
})

test("counts the balance as accrued minus already transferred", () => {
  assert.deepEqual(buildReferralBalance(1000, 800), { accruedRub: 1000, paidOutRub: 800, availableRub: 200 })
  assert.deepEqual(buildReferralBalance(500, 0).availableRub, 500)
})

test("never shows a negative balance after an over-payment", () => {
  // Администратор мог перевести больше начисленного: долг площадки перед
  // партнёром при этом нулевой, а не отрицательный.
  assert.equal(buildReferralBalance(300, 500).availableRub, 0)
})
