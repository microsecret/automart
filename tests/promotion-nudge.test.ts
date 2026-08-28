import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { FIRST_NUDGE_AFTER_MS, LOW_VIEWS_THRESHOLD, MAX_NUDGES, NUDGE_INTERVAL_MS, nudgeText, shouldNudge } from "../src/lib/promotion-nudge-rules.ts"

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8")

const day = 24 * 60 * 60 * 1000
const base = {
  publishedAt: new Date(Date.now() - 10 * day),
  views: 5,
  hasActivePromotion: false,
  nudgesSent: 0,
  lastNudgeAt: null,
}

// === Кому напоминаем ===

test("объявление без покупателей получает напоминание", () => {
  const result = shouldNudge(base)
  assert.equal(result.send, true)
  if (result.send) assert.equal(result.index, 0)
})

test("свежему объявлению не напоминаем", () => {
  /* Неделя — время, за которое видно, идут покупатели или нет. Раньше
     напоминание выглядит как навязывание сразу после публикации. */
  const fresh = { ...base, publishedAt: new Date(Date.now() - 2 * day) }
  assert.equal(shouldNudge(fresh).send, false)
  assert.equal(FIRST_NUDGE_AFTER_MS, 7 * day)
})

test("объявление, которое и так смотрят, пропускаем", () => {
  /* У объявления с сотней просмотров продвижение не главная беда — там
     дело в цене или фотографиях, и напоминание прозвучит как
     навязывание. */
  const popular = { ...base, views: LOW_VIEWS_THRESHOLD + 1 }
  const result = shouldNudge(popular)
  assert.equal(result.send, false)
  if (!result.send) assert.match(result.reason, /смотрят/)
})

test("оплатившему не напоминаем", () => {
  // Человек заплатил — напоминать не о чем.
  const paid = { ...base, hasActivePromotion: true }
  assert.equal(shouldNudge(paid).send, false)
})

test("неопубликованному не напоминаем", () => {
  assert.equal(shouldNudge({ ...base, publishedAt: null }).send, false)
})

// === Сколько раз ===

test("больше трёх раз не напоминаем", () => {
  /* Не купивший после трёх напоминаний не купит и после десятого, а
     площадка, которая долбит в личку, теряет самого продавца. */
  const done = { ...base, nudgesSent: MAX_NUDGES }
  const result = shouldNudge(done)
  assert.equal(result.send, false)
  if (!result.send) assert.match(result.reason, /достаточно/)
  assert.equal(MAX_NUDGES, 3)
})

test("между напоминаниями выдерживается срок", () => {
  const recent = { ...base, nudgesSent: 1, lastNudgeAt: new Date(Date.now() - 3 * day) }
  assert.equal(shouldNudge(recent).send, false)

  const long = { ...base, nudgesSent: 1, lastNudgeAt: new Date(Date.now() - 20 * day) }
  const result = shouldNudge(long)
  assert.equal(result.send, true)
  if (result.send) assert.equal(result.index, 1)
  assert.equal(NUDGE_INTERVAL_MS, 14 * day)
})

// === Тексты ===

test("три напоминания говорят разное", () => {
  /* Один и тот же текст трижды читается как сбой рассылки. */
  const texts = [0, 1, 2].map((index) =>
    nudgeText({ index, title: "Toyota Camry", views: 12, days: 8, priceRub: 300, planDays: 30 }))
  assert.equal(new Set(texts).size, 3, "тексты повторяются")
})

test("первое напоминание показывает цифры", () => {
  // «12 просмотров за 8 дней» продавец понимает сам.
  const text = nudgeText({ index: 0, title: "Toyota Camry", views: 12, days: 8, priceRub: 300, planDays: 30 })
  assert.match(text, /12/)
  assert.match(text, /8/)
})

test("последнее напоминание честно названо последним", () => {
  // Человек должен понимать, что его не будут дёргать бесконечно.
  const text = nudgeText({ index: 2, title: "Toyota Camry", views: 3, days: 40, priceRub: 300, planDays: 30 })
  assert.match(text, /последнее/i)
})

test("цена в сообщении берётся из тех же тарифов, что и оплата", () => {
  /* Разойдись они — человек увидит в сообщении одну сумму, а при оплате
     другую. Правила цену не знают: она приходит параметром, и рассылка
     берёт её из тарифов. */
  const rules = read("../src/lib/promotion-nudge-rules.ts")
  assert.doesNotMatch(rules, /import /, "правила должны быть без импортов")
  assert.doesNotMatch(rules, /199 рублей/)

  const sender = read("../src/lib/promotion-nudge.ts")
  assert.match(sender, /priceRub: PROMOTION_TARIFFS\.CHATS\.amountRub/)
  assert.match(sender, /planDays: PROMOTION_TARIFFS\.CHATS\.durationDays/)

  // Переданная цена доходит до текста.
  const text = nudgeText({ index: 0, title: "Машина", views: 1, days: 8, priceRub: 777, planDays: 30 })
  assert.match(text, /777/)
})

test("безымянное объявление не ломает текст", () => {
  assert.match(nudgeText({ index: 0, title: "   ", views: 1, days: 8, priceRub: 300, planDays: 30 }), /Ваше объявление/)
})

// === Рассылка ===

const sender = read("../src/lib/promotion-nudge.ts")

test("отметка ставится до отправки", () => {
  /* Сбой Telegram не должен приводить к повторному напоминанию тому же
     человеку через минуту. */
  const markAt = sender.indexOf("promotionNudges: { increment: 1 }")
  const sendAt = sender.indexOf('telegramApi("sendMessage"')
  assert.ok(markAt > 0 && sendAt > 0)
  assert.ok(markAt < sendAt, "отправка идёт раньше отметки")
})

test("заблокировавшие бота помечаются", () => {
  assert.match(sender, /markTelegramContactBlocked/)
})

test("кнопка ведёт прямо на продвижение этого объявления", () => {
  /* Заставить человека искать страницу в кабинете значит потерять
     половину тех, кто согласился. */
  assert.match(sender, /\/listings\/\$\{listingId\}\/promote/)
})

test("отсев делается запросом, а не в памяти", () => {
  /* Иначе пришлось бы тянуть все объявления площадки ради десятка
     подходящих. */
  assert.match(sender, /promotionNudges: \{ lt: MAX_NUDGES \}/)
  assert.match(sender, /views: \{ lte: LOW_VIEWS_THRESHOLD \}/)
})

test("маршрут закрыт ключом", () => {
  const route = read("../src/app/api/telegram/promotion-nudges/route.ts")
  assert.match(route, /createTelegramWorkerRoute/)
})
