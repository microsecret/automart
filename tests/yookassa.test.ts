import assert from "node:assert/strict"
import test from "node:test"
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { formatRubAmount, paymentIdFromWebhook, paymentMatchesAmount } from "../src/lib/yookassa.ts"

test("сумма форматируется с копейками", () => {
  // ЮKassa принимает сумму строкой: «499» без копеек она отклонит.
  assert.equal(formatRubAmount(499), "499.00")
  assert.equal(formatRubAmount(3990), "3990.00")
})

test("сумма платежа сверяется до копейки", () => {
  // Платёж на 1 ₽ с подделанными метаданными не должен активировать
  // тариф за 3990.
  const paid = { amount: { value: "499.00", currency: "RUB" } }
  assert.equal(paymentMatchesAmount(paid as never, 499), true)
  assert.equal(paymentMatchesAmount({ amount: { value: "1.00", currency: "RUB" } } as never, 499), false)
  assert.equal(paymentMatchesAmount({ amount: { value: "499.01", currency: "RUB" } } as never, 499), false)
})

test("валюта проверяется, а не подразумевается", () => {
  assert.equal(paymentMatchesAmount({ amount: { value: "499.00", currency: "USD" } } as never, 499), false)
})

test("из уведомления берётся только id платежа", () => {
  const id = paymentIdFromWebhook({ event: "payment.succeeded", object: { id: "2d9e-000f" } })
  assert.equal(id, "2d9e-000f")
})

test("уведомление об отмене тоже распознаётся", () => {
  assert.equal(paymentIdFromWebhook({ event: "payment.canceled", object: { id: "x1" } }), "x1")
})

test("чужие события отбрасываются", () => {
  // Обрабатываем только успех и отмену: refund и прочее — не наша ветка.
  assert.equal(paymentIdFromWebhook({ event: "refund.succeeded", object: { id: "x1" } }), null)
})

test("мусор в теле уведомления не роняет разбор", () => {
  // Обработчик уведомлений открыт в интернет: на вход придёт что угодно.
  assert.equal(paymentIdFromWebhook(null), null)
  assert.equal(paymentIdFromWebhook("строка"), null)
  assert.equal(paymentIdFromWebhook({}), null)
  assert.equal(paymentIdFromWebhook({ event: "payment.succeeded" }), null)
  assert.equal(paymentIdFromWebhook({ event: "payment.succeeded", object: { id: 42 } }), null)
})

test("нечеловечески длинный id отбрасывается", () => {
  // id идёт в адрес запроса к API — не даём накачать его мусором.
  assert.equal(paymentIdFromWebhook({ event: "payment.succeeded", object: { id: "x".repeat(65) } }), null)
})
