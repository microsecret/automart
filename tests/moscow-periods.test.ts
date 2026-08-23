import assert from "node:assert/strict"
import test from "node:test"
import {
  addMoscowDays, isMoscowPeriod, lastMoscowDayStarts, moscowDayKey, moscowDayStart,
  moscowHour, moscowMonthStart, moscowParts, moscowPeriodLabel, moscowPeriodRange,
  moscowWeekStart, previousMoscowPeriodRange,
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
} from "../src/lib/moscow-periods.ts"

// 23 августа 2026 — воскресенье. 06:38 UTC = 09:38 по Москве.
const NOW = new Date("2026-08-23T06:38:00Z")

test("период приходит с клиента и не становится произвольным", () => {
  // Запрос за произвольный отрезок положил бы базу, поэтому список закрыт.
  assert.equal(isMoscowPeriod("day"), true)
  assert.equal(isMoscowPeriod("week"), true)
  assert.equal(isMoscowPeriod("month"), true)
  assert.equal(isMoscowPeriod("30d"), false)
  assert.equal(isMoscowPeriod(""), false)
  assert.equal(isMoscowPeriod(null), false)
  assert.equal(isMoscowPeriod({ days: 999 }), false)
})

test("сутки начинаются в московскую полночь, а не в UTC-полночь", () => {
  // Московская полночь — это 21:00 UTC предыдущего дня. Раньше события с 00:00
  // до 03:00 по Москве уходили во «вчера».
  assert.equal(moscowDayStart(NOW).toISOString(), "2026-08-22T21:00:00.000Z")
})

test("событие в московскую ночь попадает в правильные сутки", () => {
  // 01:30 по Москве 23 августа = 22:30 UTC 22 августа: по UTC это ещё 22-е,
  // по Москве — уже 23-е.
  const nightEvent = new Date("2026-08-22T22:30:00Z")
  assert.equal(moscowDayKey(nightEvent), "2026-08-23")
  assert.equal(moscowDayStart(nightEvent).toISOString(), "2026-08-22T21:00:00.000Z")
  assert.ok(nightEvent >= moscowDayStart(NOW), "ночное событие должно входить в сегодняшние сутки")
})

test("событие до московской полуночи остаётся во вчерашнем дне", () => {
  // 23:59 по Москве 22 августа = 20:59 UTC того же дня.
  const lateEvent = new Date("2026-08-22T20:59:00Z")
  assert.equal(moscowDayKey(lateEvent), "2026-08-22")
  assert.ok(lateEvent < moscowDayStart(NOW), "вчерашнее событие не должно попасть в сегодня")
})

test("неделя начинается с понедельника, а не за 7 суток назад", () => {
  // 23 августа 2026 — воскресенье, значит неделя началась в понедельник 17-го:
  // полночь 17 августа по Москве = 16 августа 21:00 UTC.
  assert.equal(moscowWeekStart(NOW).toISOString(), "2026-08-16T21:00:00.000Z")
})

test("понедельник — первый день своей недели, а не последний прошлой", () => {
  // В понедельник 17 августа 00:30 по Москве неделя уже новая.
  const mondayMorning = new Date("2026-08-16T21:30:00Z")
  assert.equal(moscowWeekStart(mondayMorning).toISOString(), "2026-08-16T21:00:00.000Z")
  // А за полчаса до этого — ещё прошлая, начавшаяся 10 августа.
  const sundayNight = new Date("2026-08-16T20:30:00Z")
  assert.equal(moscowWeekStart(sundayNight).toISOString(), "2026-08-09T21:00:00.000Z")
})

test("воскресенье относится к своей неделе, а не к следующей", () => {
  // getUTCDay() отдаёт воскресенью ноль: без пересчёта неделя началась бы
  // сегодня, и цифра за неделю обнулялась бы каждое воскресенье.
  assert.equal(moscowParts(NOW).weekday, 6, "воскресенье — седьмой день недели")
  assert.equal(moscowWeekStart(NOW).toISOString(), "2026-08-16T21:00:00.000Z")
})

test("месяц календарный, а не последние 30 суток", () => {
  assert.equal(moscowMonthStart(NOW).toISOString(), "2026-07-31T21:00:00.000Z")
  const range = moscowPeriodRange("month", NOW)
  assert.equal(range.from.toISOString(), "2026-07-31T21:00:00.000Z")
  assert.equal(range.to.toISOString(), "2026-08-31T21:00:00.000Z")
})

test("февраль остаётся февралём и не растягивается до 30 дней", () => {
  // Скользящее окно в 30 дней захватывало бы кусок января: владелец хочет
  // видеть месяцы отдельно.
  const february = new Date("2026-02-14T12:00:00Z")
  const range = moscowPeriodRange("month", february)
  assert.equal(range.from.toISOString(), "2026-01-31T21:00:00.000Z")
  assert.equal(range.to.toISOString(), "2026-02-28T21:00:00.000Z")
})

test("границы месяца переживают переход через год", () => {
  const january = new Date("2026-01-05T10:00:00Z")
  assert.equal(previousMoscowPeriodRange("month", january).from.toISOString(), "2025-11-30T21:00:00.000Z")
  assert.equal(previousMoscowPeriodRange("month", january).to.toISOString(), "2025-12-31T21:00:00.000Z")

  const december = new Date("2026-12-20T10:00:00Z")
  assert.equal(moscowPeriodRange("month", december).to.toISOString(), "2026-12-31T21:00:00.000Z")
})

test("предыдущий период примыкает к текущему и не пересекается с ним", () => {
  for (const period of ["day", "week", "month"] as const) {
    const current = moscowPeriodRange(period, NOW)
    const previous = previousMoscowPeriodRange(period, NOW)
    assert.equal(previous.to.getTime(), current.from.getTime(), `${period}: отрезки не стыкуются`)
    assert.ok(previous.from < previous.to, `${period}: предыдущий отрезок пустой`)
  }
})

test("предыдущий месяц — именно прошлый месяц, а не 30 дней до него", () => {
  const march = new Date("2026-03-10T09:00:00Z")
  const previous = previousMoscowPeriodRange("month", march)
  assert.equal(previous.from.toISOString(), "2026-01-31T21:00:00.000Z", "февраль начинается 1 февраля")
  assert.equal(previous.to.toISOString(), "2026-02-28T21:00:00.000Z", "февраль кончается 1 марта")
})

test("верхняя граница периода открыта — событие ровно на ней уходит в следующий", () => {
  const range = moscowPeriodRange("day", NOW)
  assert.ok(range.to > NOW)
  // Событие ровно в момент `to` принадлежит уже следующим суткам.
  assert.equal(moscowDayKey(range.to), "2026-08-24")
})

test("час считается по Москве, а не по часовому поясу сервера", () => {
  // Сервер живёт в UTC: график активности показывал бы пик на три часа раньше.
  assert.equal(moscowHour(new Date("2026-08-23T06:38:00Z")), 9)
  assert.equal(moscowHour(new Date("2026-08-22T21:00:00Z")), 0, "московская полночь")
  assert.equal(moscowHour(new Date("2026-08-22T20:59:00Z")), 23, "минута до московской полуночи")
})

test("сдвиг на сутки работает через границу месяца и года", () => {
  const lastDayOfAugust = moscowDayStart(new Date("2026-08-31T12:00:00Z"))
  assert.equal(moscowDayKey(addMoscowDays(lastDayOfAugust, 1)), "2026-09-01")
  const newYearEve = moscowDayStart(new Date("2026-12-31T12:00:00Z"))
  assert.equal(moscowDayKey(addMoscowDays(newYearEve, 1)), "2027-01-01")
  assert.equal(moscowDayKey(addMoscowDays(newYearEve, -1)), "2026-12-30")
})

test("ось графика идёт от старых суток к сегодняшним без пропусков", () => {
  const days = lastMoscowDayStarts(7, NOW)
  assert.equal(days.length, 7)
  assert.deepEqual(days.map(moscowDayKey), [
    "2026-08-17", "2026-08-18", "2026-08-19", "2026-08-20",
    "2026-08-21", "2026-08-22", "2026-08-23",
  ])
  // Каждая точка — ровно сутки после предыдущей: дыра в оси сдвинула бы весь
  // график.
  for (let index = 1; index < days.length; index += 1) {
    assert.equal(days[index].getTime() - days[index - 1].getTime(), 24 * 60 * 60 * 1_000)
  }
})

test("ключ суток пишется с ведущими нулями", () => {
  // Без padStart «2026-8-3» ломает сортировку по строке и сопоставление точек.
  assert.equal(moscowDayKey(new Date("2026-01-03T12:00:00Z")), "2026-01-03")
  assert.equal(moscowDayKey(new Date("2026-11-25T12:00:00Z")), "2026-11-25")
})

test("подпись периода называет конкретный месяц, а не «этот»", () => {
  assert.equal(moscowPeriodLabel("month", NOW), "Август 2026")
  assert.equal(moscowPeriodLabel("month", new Date("2026-02-14T12:00:00Z")), "Февраль 2026")
  assert.equal(moscowPeriodLabel("week", NOW), "Неделя с 17 августа")
  assert.equal(moscowPeriodLabel("day", NOW), "23 августа")
})
