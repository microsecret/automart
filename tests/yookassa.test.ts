import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
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

test("сверка и уведомление активируют одним кодом", () => {
  /* Продвижение включается по уведомлению ЮKassa, а уведомление может не
     дойти: адрес задаётся руками в кабинете кассы и легко сбивается при
     смене домена. Тогда человек платит, а услуга не включается.

     Сверка спрашивает кассу сама, но активировать должна тем же кодом:
     второй такой же разошёлся бы с первым при первой правке — и одна из
     веток начала бы включать продвижение без проверки суммы или без
     транзакции. */
  const reconcile = readFileSync(new URL("../src/lib/promotion-reconcile.ts", import.meta.url), "utf8")
  assert.match(reconcile, /activatePaidPromotion/)
  assert.match(reconcile, /paymentMatchesAmount/)
  /* Своей записи в базу быть не должно — только через общий обработчик. */
  assert.doesNotMatch(reconcile, /prisma\.listing\.update/)
})

test("сверка не трогает свежие и слишком старые заказы", () => {
  /* Заказ минутной давности — человек ещё на странице оплаты, спрашивать
     кассу рано. Трёхдневный — он давно ушёл, и деньги, если были, уже
     вернулись сами. */
  const reconcile = readFileSync(new URL("../src/lib/promotion-reconcile.ts", import.meta.url), "utf8")
  assert.match(reconcile, /MAX_AGE_HOURS = 72/)
  assert.match(reconcile, /MIN_AGE_MINUTES = 1/)
  /* Ограничение на проход: при сбое, накопившем сотни заказов, разберём
     их за несколько запусков, а не одним залпом по кассе. */
  assert.match(reconcile, /take: 40/)
})

test("маршрут сверки закрыт токеном", () => {
  /* Сверка ходит в кассу и меняет статусы заказов: снаружи ей делать
     нечего. */
  const route = readFileSync(new URL("../src/app/api/payment/reconcile/route.ts", import.meta.url), "utf8")
  assert.match(route, /PARSER_TOKEN/)
  assert.match(route, /status: 401/)
})
