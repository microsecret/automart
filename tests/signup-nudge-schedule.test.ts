import assert from "node:assert/strict"
import test from "node:test"
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { MAX_NUDGES, NUDGE_VARIANTS, nudgeIndex, nudgeText } from "../src/lib/signup-nudge-schedule.ts"

const DAY = 24 * 60 * 60 * 1000
const NOW = new Date("2026-08-23T12:00:00Z")
const daysAgo = (days: number) => new Date(NOW.getTime() - days * DAY)

test("до двух недель бот молчит", () => {
  // Человек только познакомился с ботом и помнит о нём сам. Напоминание
  // в первые дни читается как навязчивость.
  assert.equal(nudgeIndex(daysAgo(0), NOW), -1)
  assert.equal(nudgeIndex(daysAgo(7), NOW), -1)
  assert.equal(nudgeIndex(daysAgo(13), NOW), -1)
})

test("первое напоминание ровно через две недели", () => {
  assert.equal(nudgeIndex(daysAgo(14), NOW), 0)
  assert.equal(nudgeIndex(daysAgo(20), NOW), 0)
})

test("дальше — тем же шагом в две недели", () => {
  assert.equal(nudgeIndex(daysAgo(28), NOW), 1)
  assert.equal(nudgeIndex(daysAgo(42), NOW), 2)
  assert.equal(nudgeIndex(daysAgo(56), NOW), 3)
})

test("после четырёх напоминаний бот замолкает навсегда", () => {
  // Два месяца — достаточный срок, чтобы человек решил. Дальше письма
  // кончаются блокировкой бота, а заблокировавший потерян насовсем.
  assert.equal(nudgeIndex(daysAgo(70), NOW), -1)
  assert.equal(nudgeIndex(daysAgo(365), NOW), -1)
})

test("дата из будущего не даёт напоминания", () => {
  // Повреждённые данные не должны приводить к рассылке.
  const future = new Date(NOW.getTime() + 5 * DAY)
  assert.equal(nudgeIndex(future, NOW), -1)
})

test("текстов ровно столько, сколько напоминаний", () => {
  // Иначе на последнем шаге рассылка обратилась бы к несуществующему
  // тексту и отправила пустое сообщение.
  assert.equal(NUDGE_VARIANTS.length, MAX_NUDGES)
})

test("имя подставляется только в первое напоминание", () => {
  // К четвёртому разу обращение по имени звучит фальшиво: человек уже
  // понял, что это рассылка.
  assert.match(nudgeText(0, "Тамерлан"), /Тамерлан/)
  assert.doesNotMatch(nudgeText(1, "Тамерлан"), /Тамерлан/)
  assert.doesNotMatch(nudgeText(3, "Тамерлан"), /Тамерлан/)
})

test("имя не ломает разметку сообщения", () => {
  // Имя приходит из Telegram и может содержать угловые скобки —
  // сообщение отправляется с разметкой HTML.
  const text = nudgeText(0, "<b>злой</b>")
  assert.ok(!text.includes("<b>злой"), `разметка не экранирована: ${text.slice(0, 60)}`)
  assert.match(text, /&lt;b&gt;/)
})

test("пустое имя не оставляет запятую в воздухе", () => {
  const text = nudgeText(0, "   ")
  assert.doesNotMatch(text, /<b>,/)
})

test("каждое напоминание говорит о своём", () => {
  // Одно и то же сообщение, пришедшее четвёртый раз, человек не читает.
  const texts = [0, 1, 2, 3].map((index) => nudgeText(index))
  assert.equal(new Set(texts).size, 4, "тексты повторяются")
})

test("в первом напоминании названы и приложение, и сайт", () => {
  // Продавец должен понимать, что объявление увидят не только в
  // Telegram: адрес сайта — то, ради чего размещение и делается.
  const text = nudgeText(0)
  assert.match(text, /lewheel\.ru/)
  assert.match(text, /бесплатн/i)
})

test("несуществующий номер не роняет рассылку", () => {
  assert.equal(nudgeText(-1), "")
  assert.equal(nudgeText(99), "")
})
