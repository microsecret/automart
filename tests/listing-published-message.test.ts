import assert from "node:assert/strict"
import test from "node:test"
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { buildPublishedMessage } from "../src/lib/listing-published-message.ts"

const base = {
  listingId: "veh123",
  title: "Renault Logan 2019",
  chatTitle: "Авторынок Казань",
  siteUrl: "https://lewheel.ru/",
  botUsername: "lewheel_bot",
}

test("продавцу сказано, что объявление опубликовано", () => {
  const message = buildPublishedMessage(base)
  assert.ok(message.text.includes("опубликовано"))
  assert.ok(message.text.includes("Renault Logan 2019"))
})

test("названо, в какой чат ушло объявление", () => {
  // Без этой строки бесплатная рассылка остаётся невидимой: продавец не
  // понимает, что уже получил, и не понимает, за что платить дальше.
  const message = buildPublishedMessage(base)
  assert.ok(message.text.includes("Авторынок Казань"))
})

test("без чата про рассылку молчим", () => {
  // Обещать отправку, которой не было, хуже, чем не сказать ничего.
  const message = buildPublishedMessage({ ...base, chatTitle: null })
  assert.ok(!message.text.includes("Отправили в чат"))
  assert.ok(message.text.includes("опубликовано"))
})

test("первая кнопка ведёт в приложение, вторая на сайт", () => {
  // Человек читает сообщение в Telegram: приложение открывается прямо
  // здесь, а сайт выбрасывает его в браузер на повторный вход.
  const message = buildPublishedMessage(base)
  /* Три кнопки: открыть в приложении, посмотреть на сайте и отправить
     друзьям — последняя добавлена, потому что поздравление о публикации
     это ровно тот момент, когда человек готов показать машину знакомым. */
  assert.equal(message.buttons.length, 3)
  assert.ok(message.buttons[0].url.startsWith("https://t.me/lewheel_bot?startapp=listing_veh123"))
  assert.equal(message.buttons[1].url, "https://lewheel.ru/listings/vehicle/veh123")
})

test("без имени бота остаётся одна ссылка на сайт", () => {
  const message = buildPublishedMessage({ ...base, botUsername: undefined })
  /* Без имени бота остаются сайт и пересылка: она ведёт на сайт и
     работает независимо от бота. */
  assert.equal(message.buttons.length, 2)
  assert.ok(message.buttons[0].url.includes("lewheel.ru"))
  assert.ok(message.buttons[1].url.includes("t.me/share/url"))
})

test("угловые скобки в заголовке экранируются", () => {
  // Сообщение уходит с разметкой HTML: незакрытый тег из заголовка
  // сломал бы отправку целиком.
  const message = buildPublishedMessage({ ...base, title: "Lada <b>Vesta</b>" })
  assert.ok(message.text.includes("Lada &lt;b&gt;Vesta&lt;/b&gt;"))
})

test("пустой заголовок не оставляет пустых кавычек", () => {
  const message = buildPublishedMessage({ ...base, title: "   " })
  assert.ok(message.text.includes("«Объявление»"))
})

test("досылка не говорит «объявление опубликовано»", () => {
  /* Объявление на площадке неделю, а в чат уходит только сейчас: такое
     сообщение читалось бы как сбой. Новость здесь про чат. */
  const message = buildPublishedMessage({ ...base, alreadyPublished: true })
  assert.ok(!message.text.includes("прошло проверку"))
  assert.ok(message.text.includes("ушло в чат"))
  assert.ok(message.text.includes("Авторынок Казань"))
})

test("свежее объявление сохраняет прежний текст", () => {
  // Правка не должна менять то, что видит продавец при одобрении.
  const message = buildPublishedMessage(base)
  assert.ok(message.text.includes("опубликовано"))
  assert.ok(message.text.includes("прошло проверку"))
})

test("кнопки одинаковы в обоих случаях", () => {
  // Человеку в любом случае нужен путь к объявлению.
  const fresh = buildPublishedMessage(base)
  const late = buildPublishedMessage({ ...base, alreadyPublished: true })
  assert.deepEqual(fresh.buttons, late.buttons)
})
