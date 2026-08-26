import assert from "node:assert/strict"
import test from "node:test"
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { moderationNotice } from "../src/lib/listing-moderation-notify.ts"

test("одобрение зовёт к продвижению", () => {
  // Момент одобрения — самая сильная точка предложения платной услуги:
  // продавец только что узнал, что объявление видно, и хочет продать
  // быстрее.
  const notice = moderationNotice("ACTIVE", "Toyota Camry 2015")
  assert.ok(notice)
  assert.equal(notice.type, "SUCCESS")
  assert.match(notice.content, /Toyota Camry 2015/)
  assert.match(notice.content, /топ|[Пп]родвижени/)
})

test("отклонение называет причину и путь исправления", () => {
  const notice = moderationNotice("REJECTED", "Лада Веста", "Нет фотографий")
  assert.ok(notice)
  assert.equal(notice.type, "WARNING")
  assert.match(notice.content, /Нет фотографий/)
  assert.match(notice.content, /бесплатно/)
})

test("отклонение без причины не ломает текст", () => {
  // Маршрут требует причину, но текст не должен падать, если её нет.
  const notice = moderationNotice("REJECTED", "Лада Веста", null)
  assert.ok(notice)
  assert.doesNotMatch(notice.content, /Причина/)
})

test("снятие с публикации объясняет, куда писать", () => {
  const notice = moderationNotice("ARCHIVED", "Лада Веста", "Продано вне площадки")
  assert.ok(notice)
  assert.match(notice.content, /поддержку/)
})

test("технические переходы не шумят", () => {
  // Черновик и ожидание модерации продавец делает сам — сообщать не о чем.
  assert.equal(moderationNotice("DRAFT", "Лада"), null)
  assert.equal(moderationNotice("PENDING_MODERATION", "Лада"), null)
})

test("пустое название не даёт пустых кавычек", () => {
  const notice = moderationNotice("ACTIVE", "  ")
  assert.ok(notice)
  assert.match(notice.content, /«Объявление»/)
})
