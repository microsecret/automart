import assert from "node:assert/strict"
import test from "node:test"
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { summarizeItemFailures } from "../src/lib/auction-failure-summary.ts"

test("без упавших лотов сводки нет", () => {
  assert.equal(summarizeItemFailures([], 10), null)
})

test("называет самую частую причину и её счёт", () => {
  const summary = summarizeItemFailures([
    { error: "HTTP 403" },
    { error: "read ECONNRESET" },
    { error: "HTTP 403" },
  ], 5)
  assert.equal(summary, "Не прошли 3 из 5; чаще всего (2): HTTP 403")
})

test("пустая причина не превращается в пустую строку", () => {
  assert.equal(summarizeItemFailures([{ error: "" }], 1), "Не прошли 1 из 1; чаще всего (1): без описания")
})
