import assert from "node:assert/strict"
import test from "node:test"
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { forwardNoticeText, isChannelForward } from "../src/lib/telegram-forward-guard.ts"

test("пересылка из канала распознаётся в новом формате", () => {
  assert.equal(isChannelForward({ forward_origin: { type: "channel", chat: { id: 1, type: "channel" } } }), true)
})

test("пересылка из канала распознаётся в старом формате", () => {
  // Клиенты Telegram обновляются вразнобой: часть присылает
  // forward_from_chat вместо forward_origin.
  assert.equal(isChannelForward({ forward_from_chat: { id: 1, type: "channel" } }), true)
})

test("пересылка сообщения человека не трогается", () => {
  // Это цитата в разговоре, а не чужая реклама: люди пересылают друг
  // другу сообщения о машинах, и удалять это значит ломать беседу.
  assert.equal(isChannelForward({ forward_origin: { type: "user" } }), false)
  assert.equal(isChannelForward({ forward_origin: { type: "hidden_user" } }), false)
})

test("пересылка из группы не трогается", () => {
  // Рекламу гонят каналами, а не группами.
  assert.equal(isChannelForward({ forward_from_chat: { id: 2, type: "supergroup" } }), false)
})

test("пост привязанного канала остаётся на месте", () => {
  // Telegram сам пересылает посты привязанного канала в обсуждение.
  // Удалить такой пост значит оставить обсуждение без заголовка.
  assert.equal(
    isChannelForward({ is_automatic_forward: true, forward_from_chat: { id: 3, type: "channel" } }),
    false,
  )
})

test("обычное сообщение пересылкой не считается", () => {
  assert.equal(isChannelForward({}), false)
})

test("предупреждение объясняет, что делать вместо пересылки", () => {
  // Тон объясняющий, а не запретительный: человек чаще всего не знал
  // правила. Если не сказать, как быть, он просто уйдёт из чата.
  const text = forwardNoticeText("Иван")
  assert.match(text, /Иван/)
  assert.match(text, /lewheel\.ru/)
  assert.match(text, /бесплатн/i)
  assert.match(text, /объявлени/i)
})

test("предупреждение исчезает само", () => {
  // Иначе служебные сообщения копятся в чате и мешают читать объявления.
  assert.match(forwardNoticeText("Иван"), /исчезнет/)
})
