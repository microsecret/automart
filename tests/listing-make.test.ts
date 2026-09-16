import assert from "node:assert/strict"
import test from "node:test"
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { matchKnownMake, normalizeListingMake } from "../src/lib/listing-make.ts"

// Написания ниже взяты из боевой базы 17 сентября 2026: 42 машины дали
// 26 вариантов написания марки.

test("каноничное имя проходит как есть", () => {
  assert.equal(matchKnownMake("Lada (ВАЗ)"), "Lada (ВАЗ)")
  assert.equal(matchKnownMake("Volkswagen"), "Volkswagen")
})

test("ВАЗ узнаётся во всех пяти написаниях из базы", () => {
  for (const raw of ["Lada", "Lada (ВАЗ)", "Vaz", "Ваз", "Лада"]) {
    assert.equal(matchKnownMake(raw), "Lada (ВАЗ)", `не узнал ${raw}`)
  }
})

test("регистр не значит ничего", () => {
  assert.equal(matchKnownMake("OPEL"), "Opel")
  assert.equal(matchKnownMake("kia"), "Kia")
  assert.equal(matchKnownMake("TOYOTA"), "Toyota")
  assert.equal(matchKnownMake("HONDA"), "Honda")
})

test("модель, приклеенная к марке, отбрасывается", () => {
  // «VOLKSWAGEN POLO» и «OPEL VIVARO» лежат в базе именно так.
  assert.equal(matchKnownMake("VOLKSWAGEN POLO"), "Volkswagen")
  assert.equal(matchKnownMake("OPEL VIVARO"), "Opel")
})

test("составная марка не обрезается до первого слова", () => {
  // «Land Rover» не должен опознаваться как «Land».
  assert.equal(matchKnownMake("Land Rover"), "Land Rover")
  assert.equal(matchKnownMake("Mercedes-Benz"), "Mercedes-Benz")
  assert.equal(matchKnownMake("mercedes benz"), "Mercedes-Benz")
})

test("русские написания узнаются", () => {
  assert.equal(matchKnownMake("Тойота"), "Toyota")
  // В справочнике марка записана как «КамАЗ» — приводим к ней, а не к
  // написанию из объявления.
  assert.equal(matchKnownMake("КАМАЗ"), "КамАЗ")
  assert.equal(matchKnownMake("камаз"), "КамАЗ")
  assert.equal(matchKnownMake("Газ"), "ГАЗ")
})

test("смешанная раскладка не плодит марку", () => {
  // Кириллическая «о» вместо латинской: источники этим грешат, а
  // выглядит одинаково.
  assert.equal(matchKnownMake("Тоyota"), "Toyota")
})

test("незнакомая марка не выдумывается", () => {
  // «Apollo» есть в базе, но не в справочнике. Приписать её к похожей
  // значило бы соврать о том, что продаётся.
  assert.equal(matchKnownMake("Apollo"), null)
  assert.equal(matchKnownMake("Неведомая марка"), null)
})

test("пустое остаётся пустым", () => {
  assert.equal(matchKnownMake(""), null)
  assert.equal(matchKnownMake("   "), null)
  assert.equal(matchKnownMake(null), null)
  assert.equal(matchKnownMake(undefined), null)
})

test("нераспознанное сохраняется, а не стирается", () => {
  assert.equal(normalizeListingMake("Apollo"), "Apollo")
  assert.equal(normalizeListingMake("  Неведомая  марка "), "Неведомая марка")
})

test("распознанное приводится к справочнику", () => {
  assert.equal(normalizeListingMake("ваз"), "Lada (ВАЗ)")
  assert.equal(normalizeListingMake("  OPEL  "), "Opel")
})
