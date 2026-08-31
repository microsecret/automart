import assert from "node:assert/strict"
import test from "node:test"
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { describeOpeningHours } from "../src/lib/opening-hours.ts"

/** Понедельник, 10 марта 2026, 14:30 по местному времени. */
const MONDAY_AFTERNOON = new Date(2026, 2, 9, 14, 30)
/** Тот же понедельник, три часа ночи. */
const MONDAY_NIGHT = new Date(2026, 2, 9, 3, 0)
/** Суббота, 14 марта 2026, полдень. */
const SATURDAY_NOON = new Date(2026, 2, 14, 12, 0)

test("круглосуточная заправка так и подписана", () => {
  /* Две трети точек в Уфе работают 24/7, и «24/7» человеку за рулём
     читать некогда. */
  const state = describeOpeningHours("24/7", MONDAY_NIGHT)
  assert.equal(state.kind, "always")
  assert.equal(state.label, "Круглосуточно")
})

test("открыта в рабочее время, закрыта ночью", () => {
  const open = describeOpeningHours("Mo-Fr 08:00-20:00", MONDAY_AFTERNOON)
  assert.equal(open.kind, "open")
  assert.equal(open.kind === "open" && open.until, "20:00")

  const closed = describeOpeningHours("Mo-Fr 08:00-20:00", MONDAY_NIGHT)
  assert.equal(closed.kind, "closed")
  assert.equal(closed.kind === "closed" && closed.opensAt, "08:00")
})

test("выходные разбираются отдельно от будней", () => {
  /* «Mo-Fr 08:00-20:00; Sa 09:00-18:00» — обычная запись: в субботу
     работает, но по-другому. */
  const rule = "Mo-Fr 08:00-20:00; Sa 09:00-18:00"
  assert.equal(describeOpeningHours(rule, SATURDAY_NOON).kind, "open")

  /* Воскресенья в правиле нет — значит закрыто, но утверждать этого мы
     не можем: показываем как есть, не выдумывая. */
  const sunday = new Date(2026, 2, 15, 12, 0)
  assert.equal(describeOpeningHours(rule, sunday).kind, "unknown")
})

test("ночная смена через полночь считается верно", () => {
  /* «22:00-06:00» — заправка открыта и в одиннадцать вечера, и в три
     ночи. Наивное сравнение «сейчас между началом и концом» здесь
     ошибается на весь ночной промежуток. */
  const rule = "Mo-Su 22:00-06:00"
  assert.equal(describeOpeningHours(rule, MONDAY_NIGHT).kind, "open")

  const evening = new Date(2026, 2, 9, 23, 0)
  assert.equal(describeOpeningHours(rule, evening).kind, "open")

  const noon = new Date(2026, 2, 9, 12, 0)
  assert.equal(describeOpeningHours(rule, noon).kind, "closed")
})

test("заворот диапазона через воскресенье", () => {
  // «Sa-Mo» — суббота, воскресенье и понедельник.
  const rule = "Sa-Mo 10:00-18:00"
  assert.equal(describeOpeningHours(rule, SATURDAY_NOON).kind, "open")
  assert.equal(describeOpeningHours(rule, MONDAY_AFTERNOON).kind, "open")

  const wednesday = new Date(2026, 2, 11, 12, 0)
  assert.equal(describeOpeningHours(rule, wednesday).kind, "unknown")
})

test("пустое и непонятное не роняет карточку", () => {
  /* У OSM есть праздники, сезоны, «первый понедельник месяца». Такое
     встречается у единиц заправок, и притворяться, что мы это поняли,
     хуже, чем ничего не показать. */
  assert.equal(describeOpeningHours(null).kind, "unknown")
  assert.equal(describeOpeningHours("").kind, "unknown")
  assert.equal(describeOpeningHours("PH off; Mo-Fr 08:00-20:00 open \"по записи\"").kind, "unknown")
})

test("слишком длинное правило не показывается сырым", () => {
  /* Строка на сорок знаков в карточке заправки — это стена текста,
     которую человек за рулём не прочитает. */
  const long = "Mo 08:00-12:00,13:00-20:00; Tu 08:00-12:00,13:00-20:00; We 09:00-19:00"
  assert.equal(describeOpeningHours(long, MONDAY_AFTERNOON).label, "")
})
