import assert from "node:assert/strict"
import test from "node:test"
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { detectDelimiter, normalizeOemNumber, parseCsvLine, parsePartImportFile, parsePrice } from "../src/lib/part-import.ts"

test("recognises the delimiter actually used in the file", () => {
  assert.equal(detectDelimiter("Название;Цена;Артикул"), ";")
  assert.equal(detectDelimiter("Название,Цена,Артикул"), ",")
  assert.equal(detectDelimiter("Название\tЦена\tАртикул"), "\t")
})

test("keeps a delimiter that sits inside quotes as part of the value", () => {
  const cells = parseCsvLine('"Фильтр масляный, оригинал";1200;OC90', ";")
  assert.deepEqual(cells, ["Фильтр масляный, оригинал", "1200", "OC90"])
})

test("reads prices in the formats sellers actually export", () => {
  assert.equal(parsePrice("12500"), 12_500)
  assert.equal(parsePrice("12 500,50 ₽"), 12_501)
  assert.equal(parsePrice("12'500"), 12_500)
  // «1,234.56» — запятая разделяет разряды; «1.234,56» — наоборот.
  assert.equal(parsePrice("1,234.56"), 1_235)
  assert.equal(parsePrice("1.234,56"), 1_235)
  assert.equal(parsePrice("2,500"), 2_500, "запятая с тремя цифрами — разряды")
})

test("rejects a price that is missing or not a number", () => {
  assert.equal(parsePrice(""), null)
  assert.equal(parsePrice("по запросу"), null)
  assert.equal(parsePrice("0"), null)
  assert.equal(parsePrice("-500"), null)
})

test("imports a normal price list", () => {
  const file = [
    "Наименование;Цена;Артикул;Бренд;Марка;Категория;Кол-во;Срок",
    "Фильтр масляный;1200;OC90;Mann;Haval;Двигатель;5;",
    "Колодки тормозные передние;3400;GDB1330;TRW;Chery;Тормоза;0;14-21 дней",
  ].join("\n")

  const result = parsePartImportFile(file)
  assert.equal(result.rows.length, 2)
  assert.equal(result.errors.length, 0)
  assert.equal(result.rows[0].oemNumber, "OC90")
  assert.equal(result.rows[0].partType, "ENGINE")
  assert.equal(result.rows[0].supplyMode, "STOCK", "положительный остаток — товар на складе")
  assert.equal(result.rows[1].partType, "BRAKES")
  assert.equal(result.rows[1].supplyMode, "ORDER", "нулевой остаток со сроком — позиция под заказ")
  assert.equal(result.rows[1].leadTimeDaysMin, 14)
  assert.equal(result.rows[1].leadTimeDaysMax, 21)
})

test("accepts good rows and explains every rejected one", () => {
  const file = [
    "Название,Цена,Артикул",
    "Свеча зажигания,890,BKR6E",
    ",1000,X1",
    "Ремень ГРМ,по запросу,CT1015",
    "Помпа,4500,GWP-330",
  ].join("\n")

  const result = parsePartImportFile(file)
  assert.equal(result.rows.length, 2, "годные строки импортируются")
  assert.equal(result.errors.length, 2, "каждая отклонённая строка объяснена")
  assert.ok(result.errors.some((error) => error.line === 3 && /название/i.test(error.reason)))
  assert.ok(result.errors.some((error) => error.line === 4 && /цена/i.test(error.reason)))
})

test("normalises an article number so any spelling finds the same part", () => {
  assert.equal(normalizeOemNumber("GDB-1330"), "GDB1330")
  assert.equal(normalizeOemNumber("gdb 1330"), "GDB1330")
  assert.equal(normalizeOemNumber("  GDB1330 "), "GDB1330")
})

test("reads cross numbers listed inside one cell", () => {
  // Разделитель колонок здесь «;», поэтому аналоги внутри ячейки перечислены
  // запятой и слэшем — так их и выгружают из учётных систем.
  const file = [
    "Название;Цена;Артикул;Аналоги",
    "Колодки передние;3400;GDB1330;D1234, 58101-1234 / LP1234",
    "Фильтр;1200;OC90;",
  ].join("\n")

  const result = parsePartImportFile(file)
  assert.deepEqual(result.rows[0].crossNumbers, ["D1234", "58101-1234", "LP1234"])
  assert.deepEqual(result.rows[1].crossNumbers, [], "пустая колонка не даёт мусорных аналогов")
})

test("drops the part own number and duplicates from its analogue list", () => {
  const file = [
    "Название;Цена;Артикул;Аналоги",
    "Колодки;3400;GDB1330;GDB-1330, D1234, d1234, ab",
  ].join("\n")

  const result = parsePartImportFile(file)
  assert.deepEqual(
    result.rows[0].crossNumbers,
    ["D1234"],
    "собственный номер, повтор в другом регистре и обрывок в два символа отбрасываются",
  )
})

test("refuses a file without the required columns instead of guessing", () => {
  const result = parsePartImportFile("Колонка1;Колонка2\nчто-то;ещё")
  assert.equal(result.rows.length, 0)
  assert.match(result.errors[0].reason, /обязательные колонки/i)
})

test("drops a duplicated row so the storefront is not littered", () => {
  const file = [
    "Название;Цена;Артикул",
    "Фильтр;1200;OC90",
    "Фильтр;1200;OC90",
  ].join("\n")

  const result = parsePartImportFile(file)
  assert.equal(result.rows.length, 1)
  assert.match(result.errors[0].reason, /дубль/i)
})

test("handles a BOM and a shuffled column order", () => {
  const file = "﻿Цена;Артикул;Наименование\n5600;12345-ABC;Амортизатор передний"
  const result = parsePartImportFile(file)
  assert.equal(result.rows.length, 1)
  assert.equal(result.rows[0].name, "Амортизатор передний")
  assert.equal(result.rows[0].price, 5_600)
  assert.equal(result.rows[0].oemNumber, "12345-ABC")
})
