import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { assessPowerPolicy, passesPowerPolicy } from "../src/lib/auction-power-policy.ts"

test("машина в пределах порога проходит", () => {
  assert.equal(passesPowerPolicy({ power: 150, fuelType: "Gasoline" }), true)
  assert.equal(passesPowerPolicy({ power: 160, fuelType: "Gasoline" }), true)
})

test("машина мощнее порога отбрасывается до перевода", () => {
  // Ради этого правило и существует: перевод описания платный, а машина
  // мощнее порога покупателю не нужна — утильсбор съедает выгоду импорта.
  const verdict = assessPowerPolicy({ power: 200, fuelType: "Gasoline" })
  assert.equal(verdict.eligible, false)
  assert.equal(verdict.reason, "power_exceeds_limit")
  assert.equal(verdict.limitHp, 160)
})

test("граница включительна", () => {
  // 160 проходит, 161 — нет: иначе поведение зависит от округления в
  // источнике.
  assert.equal(passesPowerPolicy({ power: 160 }), true)
  assert.equal(passesPowerPolicy({ power: 161 }), false)
})

test("у электромобилей свой порог", () => {
  // Льгота для электромобилей заканчивается на 80 л.с., а не на 160.
  const verdict = assessPowerPolicy({ power: 120, fuelType: "Electric" })
  assert.equal(verdict.eligible, false)
  assert.equal(verdict.limitHp, 80)
})

test("гибрид считается по электрическому порогу", () => {
  assert.equal(passesPowerPolicy({ power: 120, fuelType: "Hybrid" }), false)
  assert.equal(passesPowerPolicy({ power: 120, fuelType: "гибрид" }), false)
  assert.equal(passesPowerPolicy({ power: 70, fuelType: "PHEV" }), true)
})

test("неизвестная мощность не отбрасывается", () => {
  // Encar, Carsensor, BE FORWARD и Goo-net мощность не публикуют:
  // отбрасывать по её отсутствию значило бы потерять целые источники.
  const verdict = assessPowerPolicy({ power: null })
  assert.equal(verdict.eligible, true)
  assert.equal(verdict.reason, "power_unknown")
  assert.equal(passesPowerPolicy({}), true)
  assert.equal(passesPowerPolicy({ power: 0 }), true)
})

test("мусор в мощности не роняет разбор", () => {
  assert.equal(passesPowerPolicy({ power: Number.NaN }), true)
  assert.equal(passesPowerPolicy({ power: -5 }), true)
})

test("бензин и дизель считаются по общему порогу", () => {
  assert.equal(assessPowerPolicy({ power: 100, fuelType: "Diesel" }).limitHp, 160)
  assert.equal(assessPowerPolicy({ power: 100, fuelType: null }).limitHp, 160)
})

test("пороги не разошлись с utilization-fee", () => {
  // Значения продублированы в двух файлах (тестовый раннер не знает
  // алиас @/). Эта проверка ловит расхождение, если один изменят, а
  // другой забудут.
  const source = readFileSync(new URL("../src/lib/utilization-fee.ts", import.meta.url), "utf8")
  assert.match(source, /PREFERENTIAL_POWER_LIMIT_HP = 160/)
  assert.match(source, /PREFERENTIAL_ELECTRIC_POWER_LIMIT_HP = 80/)
  assert.equal(assessPowerPolicy({ power: 999 }).limitHp, 160)
  assert.equal(assessPowerPolicy({ power: 999, fuelType: "Electric" }).limitHp, 80)
})
