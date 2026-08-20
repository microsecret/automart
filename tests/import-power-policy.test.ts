import test from "node:test"
import assert from "node:assert/strict"
import {
  assessImportPower,
  MAX_PREFERENTIAL_HORSEPOWER,
  MAX_PREFERENTIAL_ELECTRIC_HORSEPOWER,
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
} from "../src/lib/import-power-policy.ts"

test("порог соответствует постановлению № 1291", () => {
  // 117,68 кВт для ДВС и 58,84 кВт для электро — это ровно 160 и 80 л.с.
  assert.equal(MAX_PREFERENTIAL_HORSEPOWER, 160)
  assert.equal(MAX_PREFERENTIAL_ELECTRIC_HORSEPOWER, 80)
  assert.equal(Math.round(117.68 * 1.35962), 160)
  assert.equal(Math.round(58.84 * 1.35962), 80)
})

test("пропускает машину на границе порога", () => {
  assert.equal(assessImportPower({ power: 160, fuelType: "PETROL" }).eligible, true)
  assert.equal(assessImportPower({ power: 159, fuelType: "DIESEL" }).eligible, true)
})

test("отбраковывает машину выше порога", () => {
  const assessment = assessImportPower({ power: 161, fuelType: "PETROL" })
  assert.equal(assessment.eligible, false)
  assert.equal(assessment.limit, 160)
})

test("для электромобиля действует вдвое меньший порог", () => {
  assert.equal(assessImportPower({ power: 80, fuelType: "ELECTRIC" }).eligible, true)
  assert.equal(assessImportPower({ power: 81, fuelType: "ELECTRIC" }).eligible, false)
  // Та же мощность на бензине проходит: пороги разные.
  assert.equal(assessImportPower({ power: 120, fuelType: "PETROL" }).eligible, true)
  assert.equal(assessImportPower({ power: 120, fuelType: "ELECTRIC" }).eligible, false)
})

test("гибрид считается по электрическому порогу", () => {
  assert.equal(assessImportPower({ power: 90, fuelType: "HYBRID" }).eligible, false)
})

test("лот без мощности не отбраковывается", () => {
  // Источники часто не заполняют поле: отсев по нему выбросил бы годные машины.
  assert.equal(assessImportPower({ power: null, fuelType: "PETROL" }).unknownPower, true)
  assert.equal(assessImportPower({ power: null, fuelType: "PETROL" }).eligible, true)
  assert.equal(assessImportPower({ power: 0, fuelType: null }).eligible, true)
  assert.equal(assessImportPower({}).eligible, true)
})
