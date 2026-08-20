import test from "node:test"
import assert from "node:assert/strict"
import {
  calculateUtilizationFee,
  UTILIZATION_BASE_RATE_RUB,
  PREFERENTIAL_POWER_LIMIT_HP,
  PREFERENTIAL_ELECTRIC_POWER_LIMIT_HP,
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
} from "../src/lib/utilization-fee.ts"
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { lookupVehiclePower } from "../src/lib/vehicle-power-reference.ts"

const NOW = new Date("2026-08-20T00:00:00Z")

test("пороги соответствуют постановлению № 1291", () => {
  // 117,68 кВт и 58,84 кВт — это ровно 160 и 80 л.с.
  assert.equal(PREFERENTIAL_POWER_LIMIT_HP, 160)
  assert.equal(PREFERENTIAL_ELECTRIC_POWER_LIMIT_HP, 80)
  assert.equal(UTILIZATION_BASE_RATE_RUB, 20_000)
})

test("льготная ставка для машины до трёх лет", () => {
  const result = calculateUtilizationFee({ power: 150, engineVolumeCc: 1_600, fuelType: "GASOLINE", year: 2025 }, NOW)
  assert.equal(result.preferential, true)
  assert.equal(result.feeRub, 3_400)
  assert.equal(result.olderThanThreeYears, false)
})

test("льготная ставка растёт после трёх лет", () => {
  const result = calculateUtilizationFee({ power: 150, engineVolumeCc: 1_600, fuelType: "GASOLINE", year: 2020 }, NOW)
  assert.equal(result.preferential, true)
  assert.equal(result.feeRub, 5_200)
  assert.equal(result.olderThanThreeYears, true)
})

test("граница порога включается в льготу", () => {
  assert.equal(calculateUtilizationFee({ power: 160, engineVolumeCc: 2_000, year: 2025 }, NOW).preferential, true)
  assert.equal(calculateUtilizationFee({ power: 161, engineVolumeCc: 2_000, year: 2025 }, NOW).preferential, false)
})

test("коммерческая ставка зависит от объёма двигателя", () => {
  // Разница между диапазонами двенадцатикратная — именно поэтому объём
  // обязателен для расчёта.
  const small = calculateUtilizationFee({ power: 200, engineVolumeCc: 1_998, year: 2025 }, NOW)
  const large = calculateUtilizationFee({ power: 400, engineVolumeCc: 3_800, year: 2025 }, NOW)
  assert.equal(small.feeRub, Math.round(20_000 * 5.73))
  assert.equal(large.feeRub, Math.round(20_000 * 68.15))
  assert.ok(large.feeRub! > small.feeRub! * 10)
})

test("электромобиль считается по своему порогу", () => {
  assert.equal(calculateUtilizationFee({ power: 80, fuelType: "ELECTRIC", year: 2025 }, NOW).preferential, true)
  const over = calculateUtilizationFee({ power: 217, fuelType: "ELECTRIC", year: 2025 }, NOW)
  assert.equal(over.preferential, false)
  assert.equal(over.feeRub, Math.round(20_000 * 15.73))
  // Та же мощность на бензине тоже коммерческая, но коэффициент другой.
  assert.notEqual(calculateUtilizationFee({ power: 217, engineVolumeCc: 2_500, fuelType: "GASOLINE", year: 2025 }, NOW).feeRub, over.feeRub)
})

test("без мощности сумма не выдумывается", () => {
  const result = calculateUtilizationFee({ power: null, engineVolumeCc: 2_000, year: 2025 }, NOW)
  assert.equal(result.feeRub, null)
  assert.equal(result.missing, "power")
  assert.match(result.note, /Мощность не указана/)
})

test("без объёма коммерческая сумма не выдумывается", () => {
  const result = calculateUtilizationFee({ power: 250, engineVolumeCc: null, year: 2025 }, NOW)
  assert.equal(result.feeRub, null)
  assert.equal(result.missing, "engineVolume")
})

test("справочник различает наддув в одном объёме", () => {
  // Ошибка здесь переводит машину из коммерческой ставки в льготную и
  // обманывает покупателя на сотни тысяч.
  assert.equal(lookupVehiclePower("Genesis", "G80 Gasoline 2.5 Turbo AWD"), 304)
  assert.equal(lookupVehiclePower("Hyundai", "Grandeur 2.5 Le Blanc"), 198)
  assert.equal(lookupVehiclePower("Kia", "RAY Signature"), 76)
})

test("неизвестная модель не получает выдуманную мощность", () => {
  assert.equal(lookupVehiclePower("Неизвестная", "Модель XYZ"), null)
  assert.equal(lookupVehiclePower(null, null), null)
})
