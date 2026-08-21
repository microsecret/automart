import assert from "node:assert/strict"
import test from "node:test"
import {
  findLabel,
  getTransmissionOptions,
  getFuelOptions,
  TRANSMISSIONS,
  TRUCK_TRANSMISSIONS,
  MOTORCYCLE_TRANSMISSIONS,
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
} from "../src/lib/constants.ts"

/**
 * Карточка объявления показывала «КПП OTHER»: значение приходит из импорта,
 * а в справочнике его не было, и findLabel возвращал сырую строку из базы.
 */

test("OTHER переводится во всех списках КПП", () => {
  for (const [name, list] of [
    ["легковые", TRANSMISSIONS],
    ["грузовые", TRUCK_TRANSMISSIONS],
    ["мото", MOTORCYCLE_TRANSMISSIONS],
  ] as const) {
    const label = findLabel(list, "OTHER")
    assert.notEqual(label, "OTHER", `${name}: значение осталось непереведённым`)
    assert.match(label, /[а-яё]/i, `${name}: ожидался русский текст, получено «${label}»`)
  }
})

test("КПП и топливо не показывают английские значения из базы", () => {
  // Проверяем все типы транспорта: импорт приходит с разными наборами.
  for (const type of ["CAR", "MOTORCYCLE", "TRUCK", "SPECIAL", "WATER", "AIR"]) {
    for (const option of getTransmissionOptions(type)) {
      assert.match(option.label, /[а-яё]/i, `КПП ${type}/${option.value}: «${option.label}»`)
    }
    for (const option of getFuelOptions(type)) {
      assert.match(option.label, /[а-яё0-9]/i, `Топливо ${type}/${option.value}: «${option.label}»`)
    }
  }
})

test("неизвестное значение не выдаётся за перевод", () => {
  // findLabel возвращает исходную строку — это осознанное поведение, но
  // означает, что новые значения из импорта нужно заводить в справочник.
  assert.equal(findLabel(TRANSMISSIONS, "SEQUENTIAL"), "SEQUENTIAL")
  assert.equal(findLabel(TRANSMISSIONS, null), "—")
  assert.equal(findLabel(TRANSMISSIONS, ""), "—")
})
