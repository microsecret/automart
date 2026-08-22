import assert from "node:assert/strict"
import test from "node:test"
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { containsAnyCase, searchVariants } from "../src/lib/search-terms.ts"

test("кириллица разворачивается в написания, которые встречаются в объявлениях", () => {
  const variants = searchVariants("камаз")
  assert.ok(variants.includes("камаз"), "исходный запрос")
  assert.ok(variants.includes("КАМАЗ"), "марка заглавными — так записан реальный КАМАЗ")
  assert.ok(variants.includes("Камаз"), "с заглавной первой буквы")
})

test("запрос заглавными тоже находит строчное написание", () => {
  const variants = searchVariants("ЛАДА")
  assert.ok(variants.includes("лада"))
  assert.ok(variants.includes("Лада"))
})

test("повторы не попадают в список", () => {
  // У «BMW» верхний регистр совпадает с исходным написанием.
  const variants = searchVariants("BMW")
  assert.equal(new Set(variants).size, variants.length, "дубликатов нет")
})

test("пустой запрос не даёт условий", () => {
  assert.deepEqual(searchVariants(""), [])
  assert.deepEqual(searchVariants("   "), [])
  assert.deepEqual(containsAnyCase("make", "  "), [])
})

test("лишние пробелы по краям отбрасываются", () => {
  assert.ok(searchVariants("  ваз  ").every((value) => value === value.trim()))
})

test("число написаний ограничено — запрос к базе не должен разрастаться", () => {
  assert.ok(searchVariants("Ваз 2114").length <= 6)
})

test("русское название марки находит запись латиницей", () => {
  // В каталоге марка записана как «Lada (ВАЗ)»: замер показал, что «Lada»
  // находила два объявления, а «лада» — ни одного.
  assert.ok(searchVariants("лада").includes("Lada"), "лада → Lada")
  assert.ok(searchVariants("тойота").includes("Toyota"), "тойота → Toyota")
  assert.ok(searchVariants("БМВ").includes("BMW"), "запрос заглавными тоже разворачивается")
})

test("русское название модели тоже находит запись латиницей", () => {
  // «приора» и «Priora» — та же машина: в объявлении модель записана
  // латиницей, а ищут её по-русски.
  assert.ok(searchVariants("приора").includes("Priora"))
  assert.ok(searchVariants("гранта").includes("Granta"))
})

test("незнакомое слово не подменяется", () => {
  const variants = searchVariants("сцепление")
  assert.ok(variants.includes("сцепление"))
  assert.ok(variants.every((value) => /[а-яё]/i.test(value)), "латинских подстановок нет")
})

test("условия строятся по указанному полю", () => {
  const conditions = containsAnyCase("make", "лада")
  assert.ok(conditions.length >= 2)
  for (const condition of conditions) {
    assert.ok("make" in condition, "поле подставлено")
    assert.equal(typeof condition.make.contains, "string")
  }
})
