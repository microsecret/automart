import assert from "node:assert/strict"
import test from "node:test"
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { auctionQualityModerationUpdate, createQualityHoldReason, evaluateAuctionImportItemQuality, isQualityHoldReason, QUALITY_HOLD_PREFIX } from "../src/lib/auction-quality.ts"

const soundLot = {
  make: "Hyundai",
  model: "Palisade",
  year: 2021,
  mileage: 48_000,
  sourcePrice: 32_000_000,
  engineVolume: 3_500,
  power: 295,
  imageUrl: "https://ci.encar.com/carpicture/1.jpg",
  images: ["https://ci.encar.com/carpicture/2.jpg"],
}

test("passes a complete lot without anomalies", () => {
  assert.deepEqual(evaluateAuctionImportItemQuality(soundLot).anomalies, [])
})

test("rejects placeholder make and model", () => {
  for (const identity of [{ make: "N/A", model: "Palisade" }, { make: "Hyundai", model: "-" }, { make: null, model: null }]) {
    const result = evaluateAuctionImportItemQuality({ ...soundLot, ...identity })
    assert.ok(result.anomalies.includes("не распознаны марка и модель"), JSON.stringify(identity))
  }
})

test("rejects promo prices used for price-on-request lots", () => {
  assert.ok(evaluateAuctionImportItemQuality({ ...soundLot, sourcePrice: 1 }).anomalies.includes("цена источника недостоверна"))
  assert.ok(evaluateAuctionImportItemQuality({ ...soundLot, sourcePrice: 0 }).anomalies.includes("цена источника недостоверна"))
})

test("rejects out-of-range year, mileage, engine volume and power", () => {
  const currentYear = new Date().getFullYear()
  assert.ok(evaluateAuctionImportItemQuality({ ...soundLot, year: 1890 }).anomalies.includes("год выпуска вне допустимого диапазона"))
  assert.ok(evaluateAuctionImportItemQuality({ ...soundLot, year: currentYear + 5 }).anomalies.includes("год выпуска вне допустимого диапазона"))
  assert.ok(evaluateAuctionImportItemQuality({ ...soundLot, mileage: 4_000_000 }).anomalies.includes("пробег вне допустимого диапазона"))
  assert.ok(evaluateAuctionImportItemQuality({ ...soundLot, engineVolume: 90_000 }).anomalies.includes("объём двигателя вне допустимого диапазона"))
  assert.ok(evaluateAuctionImportItemQuality({ ...soundLot, power: 9_000 }).anomalies.includes("мощность вне допустимого диапазона"))
})

test("keeps a lot with unknown optional specifications", () => {
  const result = evaluateAuctionImportItemQuality({ ...soundLot, mileage: null, engineVolume: null, power: null, year: null })
  assert.deepEqual(result.anomalies, [])
})

test("requires at least one https photo", () => {
  assert.ok(evaluateAuctionImportItemQuality({ ...soundLot, imageUrl: null, images: null }).anomalies.includes("нет ни одной пригодной фотографии"))
  assert.ok(evaluateAuctionImportItemQuality({ ...soundLot, imageUrl: "http://insecure.example/1.jpg", images: [] }).anomalies.includes("нет ни одной пригодной фотографии"))
  assert.deepEqual(evaluateAuctionImportItemQuality({ ...soundLot, imageUrl: null }).anomalies, [])
})

test("quarantines lots whose fields contradict each other", () => {
  const currentYear = new Date().getFullYear()
  const almostNew = evaluateAuctionImportItemQuality({ ...soundLot, year: currentYear, mileage: 260_000 })
  assert.ok(almostNew.anomalies.includes("пробег не соответствует году выпуска"))

  const suspiciouslyFresh = evaluateAuctionImportItemQuality({ ...soundLot, year: currentYear - 8, mileage: 300 })
  assert.ok(suspiciouslyFresh.anomalies.includes("пробег не соответствует возрасту автомобиля"))

  const electric = evaluateAuctionImportItemQuality({ ...soundLot, fuelType: "ELECTRIC", engineVolume: 2_000 })
  assert.ok(electric.anomalies.includes("у электромобиля указан объём двигателя внутреннего сгорания"))

  const conflictingManufactureDate = evaluateAuctionImportItemQuality({ ...soundLot, year: 2025, manufacturedMonth: "2023-11" })
  assert.ok(conflictingManufactureDate.anomalies.includes("год выпуска не совпадает с датой производства"))
})

test("accepts plausible combinations of age, mileage and fuel", () => {
  const currentYear = new Date().getFullYear()
  assert.deepEqual(evaluateAuctionImportItemQuality({ ...soundLot, year: currentYear - 8, mileage: 140_000 }).anomalies, [])
  assert.deepEqual(evaluateAuctionImportItemQuality({ ...soundLot, fuelType: "ELECTRIC", engineVolume: null }).anomalies, [])
  // Нулевой пробег у старого лота — это «не указан», а не противоречие.
  assert.deepEqual(evaluateAuctionImportItemQuality({ ...soundLot, year: currentYear - 8, mileage: 0 }).anomalies, [])
})

test("keeps the storage ceiling aligned with the price guard", async () => {
  // Модуль качества намеренно не импортирует price-guard, поэтому расхождение
  // констант ловится здесь, а не в продакшне.
  // @ts-expect-error Node's strip-types test runner requires the explicit extension.
  const { MAX_AUCTION_INTEGER } = await import("../src/lib/auction-price-guard.ts")
  assert.deepEqual(evaluateAuctionImportItemQuality({ ...soundLot, sourcePrice: MAX_AUCTION_INTEGER }).anomalies, [])
  assert.ok(evaluateAuctionImportItemQuality({ ...soundLot, sourcePrice: MAX_AUCTION_INTEGER + 1 }).anomalies.includes("цена источника выходит за допустимый диапазон"))
})

test("marks its own hold reason and never claims a manual one", () => {
  const reason = createQualityHoldReason(["цена источника недостоверна"])
  assert.ok(reason.startsWith(QUALITY_HOLD_PREFIX))
  assert.equal(isQualityHoldReason(reason), true)
  assert.equal(isQualityHoldReason("Скрыт администратором: жалоба покупателя"), false)
  assert.equal(isQualityHoldReason(null), false)
})

test("moves only automatic quality holds between public and quarantine states", () => {
  const now = new Date("2026-08-23T08:00:00.000Z")
  const held = auctionQualityModerationUpdate({
    adminHiddenAt: null, adminHiddenReason: null,
    anomalies: ["год выпуска не совпадает с датой производства"], now,
  })
  assert.equal(held?.status, "POLICY_EXCLUDED")
  assert.equal(held?.adminHiddenAt, now)
  assert.equal(held?.transition, "HELD")

  const restored = auctionQualityModerationUpdate({
    adminHiddenAt: now,
    adminHiddenReason: held?.adminHiddenReason || null, anomalies: [], now,
  })
  assert.equal(restored?.status, "ACTIVE")
  assert.equal(restored?.adminHiddenAt, null)
  assert.equal(restored?.transition, "RESTORED")

  const manual = auctionQualityModerationUpdate({
    adminHiddenAt: now,
    adminHiddenReason: "Скрыт администратором: подозрительная карточка", anomalies: [], now,
  })
  assert.equal(manual, null)
})
