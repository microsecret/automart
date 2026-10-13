import assert from "node:assert/strict"
import test from "node:test"
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { decodeVin, looksLikeVin, normalizeVin } from "../src/lib/vin-decode.ts"

const now = new Date("2026-10-13T00:00:00Z")

test("американский VIN: марка, год и контрольная цифра", () => {
  const result = decodeVin("1HGCM82633A004352", now)
  assert.equal(result.valid, true)
  if (!result.valid) return
  assert.equal(result.brand, "Honda")
  assert.equal(result.modelYear, 2003)
  assert.equal(result.checkDigitOk, true)
  assert.equal(result.region, "Северная Америка")
})

test("опечатка в американском VIN ловится контрольной цифрой", () => {
  const result = decodeVin("1HGCM82633A004353", now)
  assert.equal(result.valid && result.checkDigitOk, false)
})

test("европейский VIN контрольной цифрой не судится", () => {
  const result = decodeVin("WVWZZZ1KZ8W000001", now)
  assert.equal(result.valid, true)
  if (!result.valid) return
  assert.equal(result.brand, "Volkswagen")
  assert.equal(result.checkDigitOk, null)
  assert.equal(result.modelYear, 2008)
})

test("год выбирается из цикла: не в будущем дальше следующего модельного", () => {
  const lada = decodeVin("XTA210990Y2700000", now)
  assert.equal(lada.valid && lada.modelYear, 2000)
  assert.equal(lada.valid && lada.brand, "Lada (ВАЗ)")
  const fresh = decodeVin("XTAGFK330T0000001", now)
  assert.equal(fresh.valid && fresh.modelYear, 2026)
})

test("кириллица и запрещённые буквы приводятся к латинице", () => {
  assert.equal(normalizeVin("хта 21099-0у2700000"), "XTA210990Y2700000")
  assert.equal(normalizeVin("JTDKB20UO93000001"), "JTDKB20U093000001")
  assert.equal(looksLikeVin("хта210990у2700000"), true)
})

test("не VIN — понятная причина", () => {
  const short = decodeVin("ABC123", now)
  assert.equal(short.valid, false)
  assert.equal(looksLikeVin("Колодки Toyota"), false)
})

test("неизвестный код завода — марка не выдумывается", () => {
  const result = decodeVin("ZZZ00000000000000", now)
  assert.equal(result.valid && result.brand, null)
})
