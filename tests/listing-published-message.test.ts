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

test("продвижение предлагается кнопкой, а не строчкой в тексте", () => {
  /* Про продвижение было сказано словами: «в кабинете, раздел
     „Продвижение"». Человек читает и не идёт — надо запомнить, открыть
     кабинет, найти объявление, найти раздел. Замер на production:
     семнадцать активных объявлений и ноль заказов за всё время.

     Момент публикации — тот единственный, когда продавец больше всего
     хочет, чтобы его увидели. */
  const message = buildPublishedMessage({ ...base, promotionId: "order-42" })
  const promote = message.buttons.find((button) => button.text.includes("Продвинуть"))
  assert.ok(promote, "кнопки продвижения нет")
  assert.ok(promote?.url.includes("/listings/order-42/promote"), promote?.url)
})

test("адрес продвижения строится по объявлению, а не по машине", () => {
  /* Карточка живёт по /listings/vehicle/<id машины>, а продвижение по
     /listings/<id объявления>/promote — это разные записи, и подстановка
     одного вместо другого вела бы в «страница не найдена». */
  const message = buildPublishedMessage({ ...base, listingId: "veh123", promotionId: "order-42" })
  const promote = message.buttons.find((button) => button.text.includes("Продвинуть"))
  assert.ok(promote && !promote.url.includes("veh123"), "в адрес продвижения попал код машины")

  const card = message.buttons.find((button) => button.text.includes("Посмотреть на сайте"))
  assert.ok(card?.url.includes("/listings/vehicle/veh123"), card?.url)
})

test("без идентификатора объявления кнопки продвижения нет", () => {
  // Лучше без кнопки, чем кнопка в «страница не найдена».
  const message = buildPublishedMessage(base)
  assert.ok(!message.buttons.some((button) => button.text.includes("Продвинуть")))
})

test("сперва посмотреть и показать, потом платить", () => {
  /* Предлагать платное до того, как человек увидел результат, — значит
     продавать вслепую. Продвижение последним в ряду. */
  const message = buildPublishedMessage({ ...base, promotionId: "order-42" })
  assert.ok(message.buttons[message.buttons.length - 1].text.includes("Продвинуть"))
})
