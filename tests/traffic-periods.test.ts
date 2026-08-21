import assert from "node:assert/strict"
import test from "node:test"
import {
  isTrafficPeriod, periodStart, previousPeriodRange,
  refererHost, trafficSourceLabel,
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
} from "../src/lib/traffic-periods.ts"

const NOW = new Date("2026-08-21T18:00:00Z")

test("период приходит с клиента и не становится произвольным", () => {
  // Запрос за год положил бы базу, поэтому принимаются только известные значения.
  assert.equal(isTrafficPeriod("7d"), true)
  assert.equal(isTrafficPeriod("365d"), false)
  assert.equal(isTrafficPeriod(""), false)
  assert.equal(isTrafficPeriod(null), false)
  assert.equal(isTrafficPeriod({ days: 999 }), false)
})

test("начало периода отсчитывается верно", () => {
  assert.equal(periodStart("24h", NOW).toISOString(), "2026-08-20T18:00:00.000Z")
  assert.equal(periodStart("7d", NOW).toISOString(), "2026-08-14T18:00:00.000Z")
  assert.equal(periodStart("30d", NOW).toISOString(), "2026-07-22T18:00:00.000Z")
})

test("предыдущий отрезок такой же длины и не пересекается с текущим", () => {
  for (const period of ["24h", "7d", "30d"] as const) {
    const current = periodStart(period, NOW)
    const prev = previousPeriodRange(period, NOW)
    assert.equal(prev.to.getTime(), current.getTime(), `${period}: отрезки не стыкуются`)
    assert.equal(
      prev.to.getTime() - prev.from.getTime(),
      NOW.getTime() - current.getTime(),
      `${period}: длина отрезков различается`,
    )
  }
})

test("источники читаются по-человечески", () => {
  assert.equal(trafficSourceLabel(null), "Прямые заходы")
  assert.equal(trafficSourceLabel("SEARCH"), "Поисковые системы")
  assert.equal(trafficSourceLabel("REFERRAL"), "Другие сайты")
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
