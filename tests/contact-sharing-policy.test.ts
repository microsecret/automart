import assert from "node:assert/strict"
import test from "node:test"
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { inspectContactSharing, moderationAuditSummary } from "../src/lib/contact-sharing-policy.ts"

test("allows auction and delivery details without contacts", () => {
  for (const message of [
    "Лот 8696250, бюджет 1 900 000 рублей, доставка в Уфу",
    "Проверьте серьёзное повреждение правого крыла и два ключа",
    "Подтверждаю маршрут через Владивосток",
  ]) assert.equal(inspectContactSharing(message).allowed, true, message)
})

test("blocks direct and spaced phone numbers", () => {
  assert.deepEqual(inspectContactSharing("Позвоните +7 (987) 015-71-46").reasonCodes, ["PHONE"])
  assert.equal(inspectContactSharing("8 9 1 2 3 4 5 6 7 8 9").allowed, false)
})

test("blocks phone numbers written as words", () => {
  assert.equal(inspectContactSharing("девять восемь семь ноль один пять семь один четыре шесть").allowed, false)
  assert.equal(inspectContactSharing("плюс 7 девять восемь семь 015 семь один 46").allowed, false)
})

test("blocks Unicode and zero-width phone obfuscation", () => {
  assert.equal(inspectContactSharing("+٧ (٩٨٧) ٠١٥-٧١-٤٦").allowed, false)
  assert.equal(inspectContactSharing("8\u200b9\u200b1\u200b2\u200b3\u200b4\u200b5\u200b6\u200b7\u200b8\u200b9").allowed, false)
  assert.equal(inspectContactSharing("8️⃣9️⃣1️⃣2️⃣3️⃣4️⃣5️⃣6️⃣7️⃣8️⃣9️⃣").allowed, false)
})

test("blocks email, obfuscated email, links and messenger handles", () => {
  assert.equal(inspectContactSharing("mail@example.ru").allowed, false)
  assert.equal(inspectContactSharing("mail собака example точка ru").allowed, false)
  assert.equal(inspectContactSharing("https://example.ru/profile").allowed, false)
  assert.equal(inspectContactSharing("Напишите в телеграм @dealer_ufa").allowed, false)
  assert.equal(inspectContactSharing("mail@exa\u200bmple.ru").allowed, false)
  assert.equal(inspectContactSharing("Напишите в tеlеgгam @dealer_ufa").allowed, false)
})

test("audit summary never contains rejected content", () => {
  const secret = "+7 987 015-71-46"
  const summary = moderationAuditSummary(secret)
  assert.equal(summary.includes("987"), false)
  assert.match(summary, /Содержимое не сохранено/u)
})
