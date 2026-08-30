import assert from "node:assert/strict"
import test from "node:test"
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { detectSupportPlatform, supportGreeting, supportQuickReplies } from "../src/lib/support-platform.ts"

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15"
const ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36"
const WINDOWS = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120"

test("пометка приложения важнее строки клиента", () => {
  /* Внутри Telegram строка клиента выглядит как обычный мобильный
     браузер: без пометки мы бы каждый раз ошибались. */
  assert.equal(detectSupportPlatform({ fromTelegram: true, userAgent: IPHONE }), "TELEGRAM")
  assert.equal(detectSupportPlatform({ fromTelegram: true, userAgent: WINDOWS }), "TELEGRAM")
})

test("телефон отличается от компьютера", () => {
  assert.equal(detectSupportPlatform({ userAgent: IPHONE }), "MOBILE")
  assert.equal(detectSupportPlatform({ userAgent: ANDROID }), "MOBILE")
  assert.equal(detectSupportPlatform({ userAgent: WINDOWS }), "DESKTOP")
})

test("встроенное окно Telegram Desktop узнаётся по клиенту", () => {
  const agent = "Mozilla/5.0 (Windows NT 10.0) TelegramDesktop/4.14"
  assert.equal(detectSupportPlatform({ userAgent: agent }), "TELEGRAM")
})

test("без данных считаем, что человек за компьютером", () => {
  /* Ошибиться здесь не страшно: подсказка остаётся подсказкой, и человек
     поправит одним словом. */
  assert.equal(detectSupportPlatform({}), "DESKTOP")
  assert.equal(detectSupportPlatform({ userAgent: null }), "DESKTOP")
  assert.equal(detectSupportPlatform({ userAgent: "" }), "DESKTOP")
})

test("приветствие называет платформу, а не спрашивает о ней", () => {
  /* Оператор спрашивал это первым сообщением и терял минуту, а половина
     людей отвечала «с телефона», не различая приложение и браузер. */
  const greeting = supportGreeting("TELEGRAM")
  assert.ok(greeting.includes("мини-приложение Telegram"), greeting)
  assert.ok(!greeting.includes("?"), "приветствие не должно быть вопросом о платформе")
})

test("вошедшего встречают по имени", () => {
  assert.ok(supportGreeting("DESKTOP", "Тамерлан").startsWith("Здравствуйте, Тамерлан!"))
  assert.ok(supportGreeting("DESKTOP", "  ").startsWith("Здравствуйте!"))
  assert.ok(supportGreeting("DESKTOP", null).startsWith("Здравствуйте!"))
})

test("частые вопросы начинаются с того, что спрашивают именно отсюда", () => {
  assert.ok(supportQuickReplies("TELEGRAM")[0].includes("приложении"))
  assert.ok(supportQuickReplies("MOBILE")[0].includes("телефона"))
  assert.ok(supportQuickReplies("DESKTOP")[0].includes("зарегистрироваться"))
})

test("общие вопросы есть на любой платформе", () => {
  // Про запчасти и карту спрашивают отовсюду.
  for (const platform of ["TELEGRAM", "MOBILE", "DESKTOP"] as const) {
    const replies = supportQuickReplies(platform)
    assert.ok(replies.some((reply) => reply.includes("запчаст")), `нет вопроса о запчастях: ${platform}`)
    assert.ok(replies.some((reply) => reply.includes("карта")), `нет вопроса о карте: ${platform}`)
    assert.ok(replies.length >= 5, `слишком мало подсказок: ${platform}`)
  }
})
