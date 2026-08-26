import assert from "node:assert/strict"
import test from "node:test"
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { normalizePartRequest, requestClarity, requestSummary, validatePartRequest } from "../src/lib/part-request.ts"

test("заявки с одним лишь названием достаточно", () => {
  // Человек знает «нужен насос ГУР» и не знает номера. Требовать номер
  // значит потерять заявку.
  assert.deepEqual(validatePartRequest({ partName: "Насос ГУР" }), [])
})

test("заявки с одним лишь номером тоже достаточно", () => {
  // По номеру продавец найдёт деталь точнее, чем по названию.
  assert.deepEqual(validatePartRequest({ oemNumber: "44310-06090" }), [])
})

test("пустая заявка отклоняется", () => {
  const issues = validatePartRequest({ make: "Toyota", model: "Camry" })
  assert.equal(issues.length, 1)
  assert.equal(issues[0].field, "partName")
})

test("неверный год отклоняется, пустой — нет", () => {
  // Пустой год обычен: человек часто не помнит год выпуска.
  assert.deepEqual(validatePartRequest({ partName: "Фильтр", year: "" }), [])
  assert.deepEqual(validatePartRequest({ partName: "Фильтр", year: null }), [])
  assert.equal(validatePartRequest({ partName: "Фильтр", year: 1800 }).length, 1)
  assert.equal(validatePartRequest({ partName: "Фильтр", year: "позапрошлый" }).length, 1)
})

test("год следующего выпуска принимается", () => {
  // Машины продаются до наступления модельного года.
  const next = new Date().getFullYear() + 1
  assert.deepEqual(validatePartRequest({ partName: "Фильтр", year: next }), [])
})

test("VIN проверяется на длину и запрещённые буквы", () => {
  // В VIN нет I, O и Q: их исключили, чтобы не путать с 1 и 0.
  assert.deepEqual(validatePartRequest({ partName: "Фильтр", vin: "JTDBE32K123456789" }), [])
  assert.equal(validatePartRequest({ partName: "Фильтр", vin: "КОРОТКИЙ" }).length, 1)
  assert.equal(validatePartRequest({ partName: "Фильтр", vin: "JTDBE32QI23456789" }).length, 1)
})

test("номер детали приводится к единому виду", () => {
  // Один и тот же номер пишут как придётся: «44310-06090», «44310 06090».
  assert.equal(normalizePartRequest({ oemNumber: " 44310-06090 " }).oemNumber, "4431006090")
  assert.equal(normalizePartRequest({ oemNumber: "44310 06090" }).oemNumber, "4431006090")
})

test("состояние по умолчанию — любое", () => {
  // Человеку чаще всё равно, новая деталь или б/у: важна цена и срок.
  assert.equal(normalizePartRequest({ partName: "Фильтр" }).condition, "ANY")
})

test("непонятное состояние отклоняется, а не подставляется молча", () => {
  assert.equal(validatePartRequest({ partName: "Фильтр", condition: "ВОСТАНОВЛЕННАЯ" }).length, 1)
})

test("понятность заявки растёт с точностью", () => {
  // Заявка с номером и VIN обрабатывается за минуту, «фильтр на японку» —
  // требует переписки. В кабинете магазина они не должны идти вперемешку.
  const vague = requestClarity({ partName: "Фильтр" })
  const precise = requestClarity({
    partName: "Фильтр масляный", oemNumber: "90915-YZZD4",
    make: "Toyota", model: "Camry", year: 2015, vin: "JTDBE32K123456789",
  })
  assert.ok(precise > vague)
  assert.equal(precise, 100)
})

test("понятность не превышает ста", () => {
  const full = requestClarity({
    partName: "Насос", oemNumber: "44310-06090", make: "Toyota",
    model: "Camry", year: 2015, vin: "JTDBE32K123456789",
  })
  assert.ok(full <= 100)
})

test("заголовок заявки читается без расшифровки", () => {
  assert.equal(
    requestSummary({ partName: "Насос ГУР", make: "Toyota", model: "Camry", year: 2015 }),
    "Насос ГУР · Toyota Camry, 2015",
  )
})

test("заголовок обходится без марки", () => {
  assert.equal(requestSummary({ partName: "Насос ГУР" }), "Насос ГУР")
})

test("заголовок заявки без названия строится по номеру", () => {
  assert.equal(requestSummary({ oemNumber: "44310-06090" }), "Деталь 4431006090")
})

test("испорченный VIN не попадает в запись", () => {
  // Проверка уже отклонит такую заявку, но приведение не должно
  // записывать мусор, если его вызовут отдельно.
  assert.equal(normalizePartRequest({ partName: "Фильтр", vin: "не вин" }).vin, null)
})

test("длинный комментарий отклоняется", () => {
  assert.equal(validatePartRequest({ partName: "Фильтр", comment: "х".repeat(2001) }).length, 1)
})
