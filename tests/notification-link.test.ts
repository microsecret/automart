import assert from "node:assert/strict"
import test from "node:test"
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { notificationHref } from "../src/lib/notification-link.ts"

test("уведомление о предложении открывает заявки", () => {
  // Ради этого перехода уведомление и отправляется: человек ждёт ответа
  // магазина и должен увидеть цену, а не идти искать заявку по меню.
  assert.equal(notificationHref("PART_REQUEST", "abc"), "/dashboard/part-requests")
})

test("заказ и доставка ведут в свои разделы", () => {
  assert.equal(notificationHref("PART_ORDER", "abc"), "/dashboard/orders")
  assert.equal(notificationHref("DELIVERY_ORDER", "abc"), "/dashboard/deliveries")
})

test("все награды партнёра ведут в один кабинет", () => {
  // Начисление, выплата и привлечение разделены только в тексте.
  for (const type of ["REFERRAL_ATTRIBUTION", "REFERRAL_PAYOUT", "REFERRAL_REWARD"]) {
    assert.equal(notificationHref(type, "abc"), "/dashboard/referral")
  }
})

test("объявление ведёт в список, а не в собранный из id адрес", () => {
  // Адрес объявления это /listings/vehicle/{id}: типа в уведомлении нет,
  // и угаданная ссылка открыла бы «страница не найдена».
  assert.equal(notificationHref("LISTING", "abc"), "/dashboard")
  assert.equal(notificationHref("LISTING_REPORT", "abc"), "/dashboard")
})

test("ответ в теме ведёт к подпискам", () => {
  // Адрес темы требует slug раздела, которого в уведомлении нет.
  assert.equal(notificationHref("FORUM_TOPIC", "abc"), "/forum/subscriptions")
})

test("уведомление без адресата остаётся текстом", () => {
  // Лучше без кнопки, чем кнопка в пустоту.
  assert.equal(notificationHref("ADMIN_MESSAGE", "abc"), null)
  assert.equal(notificationHref("CHAT_PROMOTION_EXPIRY", "abc"), null)
  assert.equal(notificationHref("AUCTION_INQUIRY_OFFER", "abc"), null)
  assert.equal(notificationHref(null, null), null)
  assert.equal(notificationHref(undefined, undefined), null)
  assert.equal(notificationHref("ЧТО-ТО НОВОЕ", "abc"), null)
})
