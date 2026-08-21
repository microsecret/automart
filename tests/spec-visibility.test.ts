import assert from "node:assert/strict"
import test from "node:test"
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { isMeaningfulSpecValue, filterMeaningfulSpecs } from "../src/lib/spec-visibility.ts"

test("прочерки и пустые строки не показываются", () => {
  for (const value of ["—", "-", "–", "", "   ", null, undefined, "N/A"]) {
    assert.equal(isMeaningfulSpecValue(value), false, `значение ${JSON.stringify(value)} должно скрываться`)
  }
})

test("настоящие значения остаются", () => {
  for (const value of ["2025", "Другое", "0 км", "1 598 см³", 0, "Не указано"]) {
    assert.equal(isMeaningfulSpecValue(value), true, `значение ${JSON.stringify(value)} должно показываться`)
  }
})

test("ноль — это значение, а не пустота", () => {
  // У нового транспорта пробег 0 км: скрыть его значило бы соврать покупателю,
  // что пробег неизвестен.
  assert.equal(isMeaningfulSpecValue("0 км"), true)
  assert.equal(isMeaningfulSpecValue(0), true)
})

test("список фильтруется целиком", () => {
  const specs = [
    { label: "Год", value: "2025" },
    { label: "Пробег", value: "0 км" },
    { label: "Привод", value: "—" },
    { label: "Мощность", value: null },
    { label: "Топливо", value: "Другое" },
  ]
  const visible = filterMeaningfulSpecs(specs)
  assert.deepEqual(visible.map((s) => s.label), ["Год", "Пробег", "Топливо"])
})

test("полностью пустой список не ломает вызов", () => {
  assert.deepEqual(filterMeaningfulSpecs([]), [])
  assert.deepEqual(filterMeaningfulSpecs([{ value: "—" }, { value: null }]), [])
})
