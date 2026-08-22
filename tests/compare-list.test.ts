import assert from "node:assert/strict"
import test from "node:test"
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { COMPARE_LIMIT, parseCompareIds } from "../src/lib/compare-list.ts"

test("список читается из строки хранилища", () => {
  assert.deepEqual(parseCompareIds("a,b,c"), ["a", "b", "c"])
})

test("пустые значения отсеиваются", () => {
  // Строка вида "a,,b," получается после удаления машины из середины списка.
  assert.deepEqual(parseCompareIds("a,,b,"), ["a", "b"])
  assert.deepEqual(parseCompareIds(""), [])
  assert.deepEqual(parseCompareIds(null), [])
})

test("повторы не дублируются", () => {
  assert.deepEqual(parseCompareIds("a,b,a"), ["a", "b"])
})

test("список ограничен четырьмя машинами", () => {
  // Больше не помещается в таблицу: колонки становятся уже названия
  // характеристики, и сравнивать нечего.
  const ids = parseCompareIds("a,b,c,d,e,f")
  assert.equal(ids.length, COMPARE_LIMIT)
  assert.deepEqual(ids, ["a", "b", "c", "d"])
})

test("лишние пробелы вокруг значений не мешают", () => {
  assert.deepEqual(parseCompareIds(" a , b "), ["a", "b"])
})
