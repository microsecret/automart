import assert from "node:assert/strict"
import test from "node:test"
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { buildChatPost, buildPromotionOfferPost, MAX_POST_PHOTOS } from "../src/lib/chat-promotion-post.ts"

const SITE = "https://lewheel.ru"

const base = {
  id: "abc123",
  title: "Toyota Camry 2.5",
  price: 2_350_000,
  city: "Казань",
  year: 2019,
  mileage: 87_000,
  images: ["https://a/1.jpg", "https://a/2.jpg"],
}

test("цена стоит первой и с неразрывными пробелами", () => {
  // По цене человек решает, читать ли дальше. Разрыв «2 350» / «000 ₽»
  // на переносе строки делает её нечитаемой.
  const post = buildChatPost(base, { siteUrl: SITE })
  assert.ok(/2.350.000.₽/.test(post.caption))
  assert.ok(post.caption.indexOf("₽") < post.caption.indexOf("📍"))
})

test("характеристики собираются в строку", () => {
  const post = buildChatPost({ ...base, power: 181, transmission: "Автомат" }, { siteUrl: SITE })
  assert.match(post.caption, /2019 г\./)
  // Разряды toLocaleString разделяет неразрывным пробелом (код 160):
  // «87 000 км» не должно рваться на переносе строки.
  assert.ok(/87.000.км/.test(post.caption))
  assert.ok(/181.л.с./.test(post.caption))
  assert.match(post.caption, /Автомат/)
})

test("отсутствующие данные не выдумываются", () => {
  // Пост уходит незнакомым людям: неверная характеристика здесь обман,
  // а не неточность.
  const post = buildChatPost({ id: "x", title: "Лада", price: 300_000, images: [] }, { siteUrl: SITE })
  assert.doesNotMatch(post.caption, /км/)
  assert.doesNotMatch(post.caption, /л\.с\./)
  assert.doesNotMatch(post.caption, /📍/)
})

test("не больше девяти фотографий", () => {
  // Telegram принимает в альбом максимум десять вложений.
  const many = Array.from({ length: 20 }, (_, i) => `https://a/${i}.jpg`)
  const post = buildChatPost({ ...base, images: many }, { siteUrl: SITE })
  assert.equal(post.photos.length, MAX_POST_PHOTOS)
})

test("пустые адреса фотографий отбрасываются", () => {
  const post = buildChatPost({ ...base, images: ["", "https://a/1.jpg", ""] }, { siteUrl: SITE })
  assert.deepEqual(post.photos, ["https://a/1.jpg"])
})

test("теги в названии экранируются", () => {
  // Название пишет продавец: без экранирования разметка поста ломается.
  const post = buildChatPost({ ...base, title: "Toyota <b>Camry</b>" }, { siteUrl: SITE })
  assert.match(post.caption, /&lt;b&gt;/)
  assert.doesNotMatch(post.caption, /<b>Camry/)
})

test("кнопка «Написать» не раскрывает аккаунт продавца", () => {
  /* Прямая ссылка на продавца показала бы его всем читателям чата,
     включая тех, кто машиной не интересуется. Кнопка ведёт на страницу
     объявления, где связь идёт через площадку. */
  const post = buildChatPost({ ...base, sellerTelegramId: "12345" }, { siteUrl: SITE, botUsername: "lewheel_bot" })
  const write = post.buttons.find((b) => b.text.includes("Написать"))
  assert.ok(write)
  assert.doesNotMatch(write.url, /12345/)
  assert.match(write.url, /\/listings\/vehicle\//)
})

test("кнопка «Написать» не ведёт в бот по /start", () => {
  /* Так было раньше, и бот такого параметра не понимает: на любой
     /start он отвечает шагом регистрации — человек нажимал «Написать
     продавцу» и получал анкету. */
  const post = buildChatPost({ ...base, sellerTelegramId: "12345" }, { siteUrl: SITE, botUsername: "lewheel_bot" })
  const write = post.buttons.find((b) => b.text.includes("Написать"))
  assert.ok(write)
  assert.doesNotMatch(write.url, /start=listing_/)
})

test("без продавца в Telegram кнопки «Написать» нет", () => {
  const post = buildChatPost({ ...base, sellerTelegramId: null }, { siteUrl: SITE, botUsername: "lewheel_bot" })
  assert.equal(post.buttons.some((b) => b.text.includes("Написать")), false)
})

test("кнопки не ведут через startapp", () => {
  /* Telegram отвечает «bot invalid»: ссылка работает только у ботов с
     настроенным главным мини-приложением, а у нашего его нет —
     приложение подключено кнопкой меню. */
  const post = buildChatPost(base, { siteUrl: SITE, botUsername: "lewheel_bot" })
  for (const button of post.buttons) {
    assert.doesNotMatch(button.url, /startapp=/)
  }
})

test("в посте всегда есть путь к объявлению и к размещению", () => {
  // Второе — то, ради чего площадка платит за охват: читатель чата
  // должен узнать, что разместиться можно самому.
  const post = buildChatPost(base, { siteUrl: SITE })
  assert.ok(post.buttons.some((b) => b.url.includes("/listings/vehicle/abc123")))
  assert.ok(post.buttons.some((b) => b.url.includes("/listings/create/vehicle")))
})

test("подпись не превышает предел Telegram", () => {
  const post = buildChatPost({ ...base, title: "А".repeat(2000) }, { siteUrl: SITE })
  assert.ok(post.caption.length <= 1024)
})

test("рекламный пост называет охват и цену", () => {
  // Продавец решает по двум цифрам: сколько увидят и сколько стоит.
  const offer = buildPromotionOfferPost({ siteUrl: SITE, chatCount: 11, subscriberCount: 114_575, priceRub: 300 })
  assert.match(offer.caption, /11 чатах/)
  assert.match(offer.caption, /114 575/)
  assert.match(offer.caption, /300 ₽/)
  assert.match(offer.caption, /бесплатн/)
})

test("рекламный пост ведёт в кабинет и на размещение", () => {
  const offer = buildPromotionOfferPost({ siteUrl: SITE, chatCount: 11, subscriberCount: 114_575, priceRub: 300 })
  assert.ok(offer.buttons.some((b) => b.url.includes("/dashboard")))
  assert.ok(offer.buttons.some((b) => b.url.includes("/listings/create")))
})

test("объявлением можно поделиться в один тап", () => {
  /* Пересылая пост руками, человек отправлял другу картинку без кнопок,
     и тот сам искал объявление на сайте. */
  const post = buildChatPost(base, { siteUrl: SITE })
  const share = post.buttons.find((button) => button.text.includes("Поделиться"))
  assert.ok(share, "кнопки «Поделиться» нет")
  const decoded = decodeURIComponent(share.url)
  assert.ok(decoded.includes(base.id), "ссылка ведёт не на это объявление")
  assert.ok(decoded.includes(base.title), "в пересылке нет названия машины")
})

test("«Открыть объявление» остаётся первым, а приглашение продавцу последним", () => {
  /* Читатель чата пришёл смотреть машину: главное действие не должно
     уезжать под кнопки для тех, кто продаёт сам. */
  const post = buildChatPost(base, { siteUrl: SITE })
  assert.ok(post.buttons[0].text.includes("Открыть объявление"))
  assert.ok(post.buttons[post.buttons.length - 1].text.includes("Разместить"))
})

test("описание едет подписью к фото, а не отдельным текстом", () => {
  /* Пересылая пост другу, человек отправлял голые фотографии без цены,
     года и города — либо текст без единой картинки: описание жило во
     втором сообщении. Пересылают тут постоянно, ради этого объявление
     в чат и попадает. */
  const post = buildChatPost(base, { siteUrl: SITE })
  assert.ok(post.caption.includes(base.title), "в подписи нет названия")
  assert.match(post.caption, /2.350.000.₽/)
  assert.ok(post.caption.includes(base.city), "в подписи нет города")

  /* Второе сообщение несёт только кнопки: всё существенное уже сказано
     подписью, и повторять его значит показать человеку одно и то же
     дважды подряд. */
  assert.ok(!post.actionText.includes(base.title), "текст кнопок повторяет подпись")
  assert.ok(post.actionText.length < 80, "текст при кнопках должен быть коротким")
})

test("подпись укладывается в лимит Telegram", () => {
  /* Подпись к фото ограничена 1024 знаками: длиннее Telegram обрезает
     сам, в произвольном месте — посреди слова или тега. */
  const long = { ...base, title: "Очень длинное название ".repeat(60) }
  const post = buildChatPost(long, { siteUrl: SITE })
  assert.ok(post.caption.length <= 1024, `подпись ${post.caption.length} знаков`)
})
