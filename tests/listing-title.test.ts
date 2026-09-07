import assert from "node:assert/strict"
import test from "node:test"
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { tidyListingTitle, alignTitleWithCatalog } from "../src/lib/listing-title.ts"

test("крик заглавными гасится", () => {
  /* «ПРОДАМ СРОЧНО ТОРГ» в выдаче кричит поверх соседних объявлений и
     выглядит как объявление с рынка, а не с площадки. */
  assert.equal(tidyListingTitle("ПРОДАМ СРОЧНО ТОРГ"), "Продам срочно торг")
})

test("сокращения остаются заглавными", () => {
  /* «ВАЗ» и «КАМАЗ» — сокращения, а не крик: превратить их в «Ваз»
     значит испортить правильное написание. */
  assert.ok(tidyListingTitle("ВАЗ 2105 в хорошем состоянии").startsWith("ВАЗ 2105"))
  assert.ok(tidyListingTitle("2025 КАМАЗ 54901 с ADR").includes("КАМАЗ"))
  assert.ok(tidyListingTitle("2025 КАМАЗ 54901 с ADR").includes("ADR"))
})

test("первая буква поднимается", () => {
  assert.equal(tidyListingTitle("продам газель"), "Продам газель")
})

test("лишние пробелы и знаки убираются", () => {
  assert.equal(tidyListingTitle("  Лада   Гранта !!!  "), "Лада Гранта !")
  assert.equal(tidyListingTitle("Срочно?? Торг"), "Срочно? Торг")
})

test("марка и модель берутся из справочника", () => {
  /* «Лада калина 1» при справочных «Лада» и «Калина» — опечатка в
     регистре, а не выбор автора: то же слово в справочнике записано
     верно, и продавец его же и выбрал из списка. */
  assert.equal(alignTitleWithCatalog("Лада калина 1", "Лада", "Калина"), "Лада Калина 1")
  assert.equal(alignTitleWithCatalog("продам ваз 2105", "ВАЗ", "2105"), "продам ВАЗ 2105")
})

test("марка с дефисом не ломает разбор", () => {
  /* Название приходит из справочника: «Mercedes-Benz» в регулярном
     выражении читался бы как набор символов, а не как слово. */
  assert.equal(alignTitleWithCatalog("mercedes-benz e-класс", "Mercedes-Benz", null), "Mercedes-Benz e-класс")
})

test("непохожие слова не трогаются", () => {
  /* «Калина-универсал» — уточнение автора, а не опечатка: заменять его
     на справочное значило бы переписывать смысл. */
  assert.equal(alignTitleWithCatalog("Лада Калина-универсал", "Лада", "Калина"), "Лада Калина-универсал")
})

test("пустой заголовок не ломает приведение", () => {
  assert.equal(tidyListingTitle("   "), "")
  assert.equal(alignTitleWithCatalog("Лада", null, null), "Лада")
})
