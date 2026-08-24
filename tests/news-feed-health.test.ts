import assert from "node:assert/strict"
import test from "node:test"
import { checkNewsFeed, isFeedBroken } from "../src/lib/news-feed-health.js"

const NOW = new Date("2026-08-24T12:00:00Z")

function hoursAgo(hours: number): Date {
  return new Date(NOW.getTime() - hours * 3_600_000)
}

test("свежая новость — канал в порядке", () => {
  const check = checkNewsFeed(hoursAgo(1), NOW)
  assert.equal(check.state, "ok")
  assert.equal(isFeedBroken(check), false)
})

test("ночная пауза тревогой не считается", () => {
  // Редактор присылает новости неравномерно: с полуночи до утра пауза
  // обычна. Тревога на каждую такую паузу приучает не смотреть на
  // предупреждения вовсе.
  const check = checkNewsFeed(hoursAgo(8), NOW)
  assert.equal(check.state, "quiet")
  assert.equal(isFeedBroken(check), false)
})

test("сутки тишины — поломка", () => {
  // Ровно этот случай и произошёл 23 августа: токен заменили, редактор
  // сутки получал 401, лента молчала, и никто не заметил.
  const check = checkNewsFeed(hoursAgo(26), NOW)
  assert.equal(check.state, "broken")
  assert.equal(isFeedBroken(check), true)
})

test("сообщение о поломке называет причину и где смотреть", () => {
  // Без этого дежурный видит «новостей нет» и начинает искать с нуля.
  const check = checkNewsFeed(hoursAgo(30), NOW)
  assert.match(check.message, /NEWS_IMPORT_TOKEN/)
  assert.match(check.message, /401/)
  assert.match(check.message, /nginx/)
})

test("пустая лента — тоже повод для тревоги", () => {
  const check = checkNewsFeed(null, NOW)
  assert.equal(check.state, "empty")
  assert.equal(isFeedBroken(check), true)
})

test("часы склоняются по-русски", () => {
  // «Новостей нет 26.4 hours» в письме дежурному читать невозможно.
  assert.match(checkNewsFeed(hoursAgo(21), NOW).message, /21 час /)
  assert.match(checkNewsFeed(hoursAgo(22), NOW).message, /22 часа /)
  assert.match(checkNewsFeed(hoursAgo(25), NOW).message, /25 часов/)
  assert.match(checkNewsFeed(hoursAgo(11), NOW).message, /11 часов/)
})

test("дробные часы пишутся через запятую", () => {
  assert.match(checkNewsFeed(hoursAgo(26.4), NOW).message, /26,4/)
})

test("граница суток включительно", () => {
  // 23,9 часа — ещё тишина, 24 — уже поломка. Без этого граница
  // «плавает» и поведение зависит от секунд.
  assert.equal(checkNewsFeed(hoursAgo(23.9), NOW).state, "quiet")
  assert.equal(checkNewsFeed(hoursAgo(24), NOW).state, "broken")
})

test("расхождение часов сервера не выдаётся за поломку", () => {
  // Время в базе иногда оказывается впереди системного: пугать
  // сообщением о поломке из-за этого нельзя.
  const check = checkNewsFeed(new Date(NOW.getTime() + 3_600_000), NOW)
  assert.equal(check.state, "ok")
})

test("испорченная дата не роняет проверку", () => {
  assert.equal(checkNewsFeed("не дата", NOW).state, "empty")
})

test("строковая дата принимается наравне с Date", () => {
  // Prisma отдаёт Date, ответ API — строку.
  const iso = hoursAgo(30).toISOString()
  assert.equal(checkNewsFeed(iso, NOW).state, checkNewsFeed(hoursAgo(30), NOW).state)
})
