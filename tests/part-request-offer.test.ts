import assert from "node:assert/strict"
import test from "node:test"
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { offerSummary, parsePartOffer } from "../src/lib/part-request-offer.ts"

test("одной цены достаточно", () => {
  // Магазин часто отвечает одним числом: деталь есть, стоит столько.
  const result = parsePartOffer({ price: 4500 })
  assert.equal(result.ok, true)
  assert.equal(result.ok && result.data.price, 4500)
})

test("одного пояснения достаточно", () => {
  // «Пришлите VIN — подберу» это полноценный ответ: без VIN деталь
  // не подобрать, и цену назвать нечестно.
  const result = parsePartOffer({ comment: "Пришлите VIN, подберу точно" })
  assert.equal(result.ok, true)
  assert.equal(result.ok && result.data.comment, "Пришлите VIN, подберу точно")
})

test("ноль дней — это «в наличии», а не пустое поле", () => {
  // Самый ценный ответ из возможных: деталь на полке. Если считать ноль
  // за пропуск, такое предложение отклонится как пустое.
  const result = parsePartOffer({ leadTimeDays: 0 })
  assert.equal(result.ok, true)
  assert.equal(result.ok && result.data.leadTimeDays, 0)
})

test("пустое предложение отклоняется", () => {
  // Человек оставил заявку ради ответа, а не ради отметки о просмотре.
  const result = parsePartOffer({})
  assert.equal(result.ok, false)
  assert.equal(result.ok === false && result.error, "Укажите цену, срок или напишите пояснение")
})

test("предложение из одних пробелов отклоняется", () => {
  assert.equal(parsePartOffer({ comment: "   \n  " }).ok, false)
})

test("тело запроса может отсутствовать", () => {
  // Сломанный JSON приходит как null: падать на этом нельзя.
  assert.equal(parsePartOffer(null).ok, false)
})

test("нечисловая цена отклоняется", () => {
  const result = parsePartOffer({ price: "договорная" })
  assert.equal(result.ok, false)
  assert.equal(result.ok === false && result.error, "Цена должна быть положительным числом")
})

test("отрицательная и запредельная цена отклоняются", () => {
  assert.equal(parsePartOffer({ price: -100 }).ok, false)
  assert.equal(parsePartOffer({ price: 0 }).ok, false)
  assert.equal(parsePartOffer({ price: 200_000_000 }).ok, false)
})

test("цена округляется до рубля", () => {
  const result = parsePartOffer({ price: 4500.7 })
  assert.equal(result.ok && result.data.price, 4501)
})

test("срок вне года отклоняется", () => {
  assert.equal(parsePartOffer({ leadTimeDays: -1 }).ok, false)
  assert.equal(parsePartOffer({ leadTimeDays: 400 }).ok, false)
  assert.equal(parsePartOffer({ leadTimeDays: 365 }).ok, true)
})

test("состояние принимается только известное", () => {
  const fresh = parsePartOffer({ price: 100, condition: "NEW" })
  assert.equal(fresh.ok && fresh.data.condition, "NEW")
  // Чужое значение не должно доехать до базы под видом состояния.
  const junk = parsePartOffer({ price: 100, condition: "ВОЗМОЖНО" })
  assert.equal(junk.ok && junk.data.condition, null)
})

test("длинное пояснение обрезается, а не отклоняется", () => {
  // Человек написал много — это не повод терять предложение целиком.
  const result = parsePartOffer({ comment: "я".repeat(2000) })
  assert.equal(result.ok && result.data.comment?.length, 1000)
})

test("сводка читается без открытия страницы", () => {
  assert.equal(offerSummary({ price: 4500, leadTimeDays: 0 }), "4 500 ₽ · в наличии")
  assert.equal(offerSummary({ price: 4500, leadTimeDays: 3 }), "4 500 ₽ · срок 3 дн")
  assert.equal(offerSummary({ price: null, leadTimeDays: null }), "")
})
