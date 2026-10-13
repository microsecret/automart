import assert from "node:assert/strict"
import test from "node:test"
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { detectProductGroup, formatAttributeValue, PRODUCT_GROUP_BY_KEY, PRODUCT_GROUPS, readProductAttributes } from "../src/lib/product-groups.ts"

const attrs = (key: string, name: string, columns: Record<string, string> = {}) => {
  const group = PRODUCT_GROUP_BY_KEY.get(key)
  assert.ok(group, key)
  return Object.fromEntries(readProductAttributes(group, name, columns).map((value: { key: string; num: number | null; text: string | null }) => [value.key, value.num ?? value.text]))
}

test("аккумуляторы из прайса avtovek: ёмкость, ток, габариты", () => {
  assert.equal(detectProductGroup("ELAB azia 6ст-62 Ач D23 пуск. ток 600, раз. 232x173x225")?.key, "battery")
  assert.deepEqual(attrs("battery", "ELAB azia 6ст-62 Ач D23 пуск. ток 600, раз. 232x173x225"), {
    capacity: 62, coldCrank: 600, length: 232, width: 173, height: 225, terminals: "Тонкие (азиатские)",
  })
  const moto = attrs("battery", "DS 12-05.1 Red Energy (114x70x106) ГЕЛЕВЫЙ")
  assert.equal(moto.length, 114)
  assert.equal(moto.technology, "Гелевый")
  assert.equal(attrs("battery", "Аккумулятор 60 Ач обратная полярность 540A").polarity, "Обратная (+ справа)")
})

test("колонка прайса важнее догадки по названию", () => {
  const values = attrs("battery", "6ст-60 Ач", { "Ёмкость, Ач": "62", "Полярность": "прямая" })
  assert.equal(values.capacity, 62)
  assert.equal(values.polarity, "Прямая (+ слева)")
})

test("масла: моторное и трансмиссионное не путаются", () => {
  assert.equal(detectProductGroup("Масло моторное Mobil Super 3000 5W-40 4л синтетическое")?.key, "engine_oil")
  assert.equal(detectProductGroup("Масло трансмиссионное Castrol 75W-90 GL-4 1л")?.key, "transmission_oil")
  assert.equal(detectProductGroup("Жидкость ATF Dexron III 1л")?.key, "transmission_oil")
  assert.deepEqual(attrs("engine_oil", "Масло моторное Mobil Super 3000 5W-40 4л синтетическое API SN ACEA A3/B4"), {
    viscosity: "5W-40", volume: 4, oilBase: "Синтетическое", api: "SN", acea: "A3/B4",
  })
  assert.equal(attrs("engine_oil", "Shell Helix HX7 10w40 полусинтетика 1 л").oilBase, "Полусинтетическое")
})

test("шины: размер, индексы, сезон, шипы", () => {
  assert.equal(detectProductGroup("Nokian Hakkapeliitta 10 205/55 R16 94T шип")?.key, "tires")
  assert.deepEqual(attrs("tires", "Nokian Hakkapeliitta 10 205/55 R16 94T XL зимняя шип"), {
    width: 205, profile: 55, diameter: 16, loadIndex: "94", speedIndex: "T", season: "Зимние", studded: "Шипованные",
  })
  assert.equal(attrs("tires", "Michelin X-Ice 225/45 R17 нешип").studded, "Нешипованные")
})

test("диски: ширина, диаметр, сверловка, вылет, ступица", () => {
  assert.deepEqual(attrs("wheels", "Диск литой K&K 7x17 5x114.3 ET45 D67.1"), {
    rimWidth: 7, diameter: 17, pcd: "5x114.3", et: 45, dia: 67.1, wheelType: "Литой",
  })
})

test("жидкости, фильтры, лампы, щётки", () => {
  assert.deepEqual(attrs("antifreeze", "Антифриз Felix Carbox G12+ красный 5 кг -40"), { class: "G12+", freezePoint: -40 })
  assert.equal(attrs("brake_fluid", "Тормозная жидкость DOT 4 0,5 л").standard, "DOT 4")
  assert.equal(attrs("brake_fluid", "Тормозная жидкость DOT 4 0,5 л").volume, 0.5)
  assert.equal(detectProductGroup("Фильтр салонный угольный MANN CUK 2939")?.key, "cabin_filter")
  assert.equal(attrs("cabin_filter", "Фильтр салонный угольный MANN CUK 2939").carbon, "Угольный")
  assert.deepEqual(attrs("bulbs", "Лампа H7 12V 55W галогенная Osram"), { base: "H7", lampType: "Галогенная", power: 55, voltage: 12 })
  assert.deepEqual(attrs("wiper_blades", "Щётка стеклоочистителя бескаркасная 600 мм"), { length: 600, bladeType: "Бескаркасная" })
  assert.equal(attrs("wiper_blades", "Дворник гибридный 24\"").length, 600)
})

test("колодки и тормозные диски различаются, ось читается", () => {
  assert.equal(detectProductGroup("Колодки тормозные передние Brembo P 83 052")?.key, "brake_pads")
  assert.equal(attrs("brake_pads", "Колодки тормозные передние Brembo").axle, "Передняя")
  assert.equal(detectProductGroup("Диск тормозной задний вентилируемый 300x22")?.key, "brake_discs")
  assert.deepEqual(attrs("brake_discs", "Диск тормозной задний вентилируемый 300x22"), { axle: "Задняя", ventilated: "Вентилируемый", diameter: 300, thickness: 22 })
})

test("незнакомое — без группы и без выдуманных характеристик", () => {
  assert.equal(detectProductGroup("Рычаг подвески передний левый Toyota Camry"), null)
  assert.deepEqual(attrs("battery", "Аккумулятор"), {})
  assert.deepEqual(attrs("battery", "Аккумулятор", { "Ёмкость, Ач": "много" }), {})
})

test("значения выводятся с единицами", () => {
  const capacity = PRODUCT_GROUP_BY_KEY.get("battery").attributes.find((item: { key: string }) => item.key === "capacity")
  assert.equal(formatAttributeValue(capacity, { num: 62, text: null }), "62 Ач")
  assert.equal(formatAttributeValue(undefined, { num: null, text: "5W-30" }), "5W-30")
})

test("ключи групп и характеристик уникальны", () => {
  const groupKeys = PRODUCT_GROUPS.map((group: { key: string }) => group.key)
  assert.equal(new Set(groupKeys).size, groupKeys.length)
  for (const group of PRODUCT_GROUPS) {
    const keys = group.attributes.map((item: { key: string }) => item.key)
    assert.equal(new Set(keys).size, keys.length, group.key)
    assert.ok(group.attributes.filter((item: { summary?: boolean }) => item.summary).length <= 4, group.key)
  }
})
