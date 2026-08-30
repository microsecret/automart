import assert from "node:assert/strict"
import test from "node:test"
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { buildTelegramPageUrl } from "../src/lib/telegram-page-url.ts"

const BASE = "https://lewheel.ru/telegram"

test("кнопка открывает обещанную страницу, а не главный экран", () => {
  // «Открыть заказы» вело в ленту машин: человек искал заново то, о чём
  // его только что известили.
  assert.equal(
    buildTelegramPageUrl(BASE, "/dashboard/orders"),
    "https://lewheel.ru/dashboard/orders?from=telegram",
  )
})

test("страница помечается как переход из Telegram", () => {
  // Без пометки к странице приедут десктопная шапка и подвал.
  const url = buildTelegramPageUrl(BASE, "/messages/abc")
  assert.equal(new URL(String(url)).searchParams.get("from"), "telegram")
})

test("собственные параметры страницы сохраняются", () => {
  const url = buildTelegramPageUrl(BASE, "/messages?filter=unread")
  assert.equal(new URL(String(url)).searchParams.get("filter"), "unread")
  assert.equal(new URL(String(url)).searchParams.get("from"), "telegram")
})

test("чужой адрес не подставляется", () => {
  // Telegram чужой домен в мини-приложении не откроет, и возможности
  // подставить его быть не должно.
  assert.equal(buildTelegramPageUrl(BASE, "https://example.com/steal"), null)
})

test("без адреса мини-приложения кнопки нет", () => {
  // Бот может работать там, где мини-приложение не настроено.
  assert.equal(buildTelegramPageUrl(null, "/dashboard/orders"), null)
})

test("испорченный путь не роняет уведомление", () => {
  // Уведомление важнее кнопки: без неё сообщение всё равно уйдёт.
  assert.equal(buildTelegramPageUrl("не адрес", "/dashboard"), null)
})
