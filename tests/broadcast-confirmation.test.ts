import assert from "node:assert/strict"
import test from "node:test"
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { LARGE_BROADCAST_THRESHOLD, broadcastBlockReason, describeBroadcast } from "../src/lib/broadcast-confirmation.ts"

test("число получателей стоит в заголовке", () => {
  // Именно оно останавливает руку, а не слово «внимание».
  const confirmation = describeBroadcast("all", 1240, "Здравствуйте, у нас новости")
  assert.match(confirmation.title, /1240/)
})

test("сказано, что отменить нельзя", () => {
  // Рассылка уходила по одному нажатию, и отозвать её невозможно.
  const confirmation = describeBroadcast("all", 100, "Текст рассылки для проверки")
  assert.match(confirmation.message, /нельзя/)
})

test("названа группа получателей", () => {
  // «Всем» и «тем, кто не завершил регистрацию» — разные вещи, и
  // перепутать их легко: выбор стоит выше кнопки.
  assert.match(describeBroadcast("unregistered", 50, "Текст рассылки").message, /не завершил/)
  assert.match(describeBroadcast("registered", 50, "Текст рассылки").message, /завершил регистрацию/)
})

test("показано начало текста", () => {
  // Человек видит, что именно уйдёт, а не полагается на память.
  const confirmation = describeBroadcast("all", 10, "Скидка на размещение до конца недели")
  assert.match(confirmation.message, /Скидка на размещение/)
})

test("длинный текст обрезается", () => {
  const confirmation = describeBroadcast("all", 10, "х".repeat(300))
  assert.match(confirmation.message, /…/)
  assert.ok(confirmation.message.length < 400)
})

test("крупная рассылка отмечается особо", () => {
  assert.equal(describeBroadcast("all", LARGE_BROADCAST_THRESHOLD, "Текст").large, true)
  assert.equal(describeBroadcast("all", LARGE_BROADCAST_THRESHOLD - 1, "Текст").large, false)
})

test("у крупной рассылки на кнопке стоит число", () => {
  // Кнопка «Отправить» нажимается по привычке; «Отправить 1200
  // получателям» заставляет прочитать.
  const confirmation = describeBroadcast("all", 1200, "Текст")
  assert.match(confirmation.confirmLabel, /1200/)
})

test("получатели склоняются", () => {
  assert.match(describeBroadcast("all", 1, "Текст").title, /1 получателю/)
  assert.match(describeBroadcast("all", 11, "Текст").title, /11 получателям/)
  assert.match(describeBroadcast("all", 21, "Текст").title, /21 получателю/)
  assert.match(describeBroadcast("all", 5, "Текст").title, /5 получателям/)
})

test("неизвестное число получателей не ломает заголовок", () => {
  // Счётчик может не успеть загрузиться, и отправка не должна выглядеть
  // сломанной.
  const confirmation = describeBroadcast("all", null, "Текст")
  assert.equal(confirmation.title, "Отправить рассылку?")
  assert.equal(confirmation.large, false)
})

test("пустой текст не даёт отправить", () => {
  assert.ok(broadcastBlockReason("", 100))
  assert.ok(broadcastBlockReason("   ", 100))
})

test("слишком короткий текст не даёт отправить", () => {
  // «Привет» на всю базу — это почти всегда случайное нажатие.
  assert.ok(broadcastBlockReason("Привет", 100))
})

test("пустая группа не даёт отправить", () => {
  assert.ok(broadcastBlockReason("Нормальный текст рассылки", 0))
})

test("готовая рассылка проходит", () => {
  assert.equal(broadcastBlockReason("Нормальный текст рассылки", 100), null)
})

test("неизвестное число получателей отправку не блокирует", () => {
  // Иначе счётчик, не успевший загрузиться, запрещает работу.
  assert.equal(broadcastBlockReason("Нормальный текст рассылки", null), null)
})
