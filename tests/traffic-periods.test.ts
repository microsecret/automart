import assert from "node:assert/strict"
import test from "node:test"
import {
  isTrafficPeriod, periodLabel, periodRange, periodStart, previousPeriodRange,
  refererHost, trafficSourceLabel,
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
} from "../src/lib/traffic-periods.ts"

// 21 августа 2026 — пятница. 18:00 UTC = 21:00 по Москве.
const NOW = new Date("2026-08-21T18:00:00Z")

test("период приходит с клиента и не становится произвольным", () => {
  // Запрос за год положил бы базу, поэтому принимаются только известные значения.
  assert.equal(isTrafficPeriod("week"), true)
  assert.equal(isTrafficPeriod("365d"), false)
  assert.equal(isTrafficPeriod("7d"), false, "скользящих окон больше нет")
  assert.equal(isTrafficPeriod(""), false)
  assert.equal(isTrafficPeriod(null), false)
  assert.equal(isTrafficPeriod({ days: 999 }), false)
})

test("начало периода — московская полночь календарного отрезка", () => {
  // Московская полночь = 21:00 UTC предыдущего дня.
  assert.equal(periodStart("day", NOW).toISOString(), "2026-08-20T21:00:00.000Z")
  // Пятница 21-го относится к неделе, начавшейся в понедельник 17-го.
  assert.equal(periodStart("week", NOW).toISOString(), "2026-08-16T21:00:00.000Z")
  assert.equal(periodStart("month", NOW).toISOString(), "2026-07-31T21:00:00.000Z")
})

test("период закрыт сверху и содержит текущий момент", () => {
  for (const period of ["day", "week", "month"] as const) {
    const range = periodRange(period, NOW)
    assert.ok(range.from <= NOW, `${period}: начало позже текущего момента`)
    assert.ok(range.to > NOW, `${period}: конец раньше текущего момента`)
  }
})

test("предыдущий отрезок примыкает к текущему и не пересекается с ним", () => {
  for (const period of ["day", "week", "month"] as const) {
    const current = periodStart(period, NOW)
    const previous = previousPeriodRange(period, NOW)
    assert.equal(previous.to.getTime(), current.getTime(), `${period}: отрезки не стыкуются`)
    assert.ok(previous.from < previous.to, `${period}: предыдущий отрезок пустой`)
  }
})

test("подпись периода называет конкретную дату", () => {
  assert.equal(periodLabel("month", NOW), "Август 2026")
  assert.equal(periodLabel("week", NOW), "Неделя с 17 августа")
  assert.equal(periodLabel("day", NOW), "21 августа")
})

test("источники читаются по-человечески", () => {
  assert.equal(trafficSourceLabel(null), "Прямые заходы")
  assert.equal(trafficSourceLabel("SEARCH"), "Поисковые системы")
  // Запись из базы называется ORGANIC_SEARCH — без неё в списке появлялся
  // технический код вместо названия.
  assert.equal(trafficSourceLabel("ORGANIC_SEARCH"), "Поисковые системы")
  assert.equal(trafficSourceLabel("REFERRAL"), "Другие сайты")
  // Приложение и ссылка из чата — разные каналы: в приложении человек
  // уже внутри площадки, по ссылке он только переходит на неё.
  assert.equal(trafficSourceLabel("TELEGRAM"), "Telegram")
  assert.equal(trafficSourceLabel("TELEGRAM_APP"), "Приложение в Telegram")
  assert.match(trafficSourceLabel("UTM:TELEGRAM-MINI-APP"), /telegram-mini-app/)
  // Неизвестный код не теряется, а показывается как есть.
  assert.equal(trafficSourceLabel("SOMETHING_NEW"), "SOMETHING_NEW")
})

test("домен реферера чистится от www и мусора", () => {
  assert.equal(refererHost("https://www.google.com/search?q=авто"), "google.com")
  assert.equal(refererHost("https://yandex.ru/"), "yandex.ru")
  assert.equal(refererHost("не ссылка"), null)
  assert.equal(refererHost(null), null)
  assert.equal(refererHost(""), null)
})
