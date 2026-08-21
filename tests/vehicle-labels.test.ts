import assert from "node:assert/strict"
import test from "node:test"
import {
  findLabel,
  getTransmissionOptions,
  getFuelOptions,
  getSelectableFuelOptions,
  getSelectableTransmissionOptions,
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

test("«Другое» не предлагается продавцу при подаче", () => {
  // Четыре активных объявления из пяти были поданы с OTHER и в топливе, и в
  // коробке: это самый быстрый способ пропустить поле, а покупатель остаётся
  // без данных, ради которых открыл карточку.
  for (const type of ["CAR", "MOTORCYCLE", "TRUCK"]) {
    const transmissions = getSelectableTransmissionOptions(type)
    assert.ok(transmissions.length > 0, `${type}: список КПП опустел`)
    assert.ok(
      !transmissions.some((option) => option.value === "OTHER"),
      `${type}: «Другое» осталось в выборе КПП`,
    )
  }

  for (const type of ["CAR", "TRUCK", "AIR"]) {
    const fuels = getSelectableFuelOptions(type)
    assert.ok(fuels.length > 0, `${type}: список топлива опустел`)
    assert.ok(
      !fuels.some((option) => option.value === "OTHER"),
      `${type}: «Другое» осталось в выборе топлива`,
    )
  }
})

test("«Другое» остаётся для показа импортных лотов", () => {
  // Значение приходит из чужих каталогов: убрать его из справочника значило
  // бы вернуть английское OTHER в карточку.
  assert.equal(findLabel(TRANSMISSIONS, "OTHER"), "Другая")
  assert.ok(getTransmissionOptions("CAR").some((option) => option.value === "OTHER"))
  assert.ok(getFuelOptions("CAR").some((option) => option.value === "OTHER"))
})
