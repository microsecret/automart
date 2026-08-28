import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { INTENT_PARAM, PENDING_INTENTS, isPendingIntent, readIntent, returnUrlWithIntent, stripIntent } from "../src/lib/pending-intent.ts"

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8")

test("список намерений закрытый", () => {
  /* Произвольная строка из адреса превратилась бы в способ заставить
     чужой браузер выполнить действие по ссылке. */
  assert.ok(PENDING_INTENTS.length <= 5)
  assert.equal(isPendingIntent("phone"), true)
  assert.equal(isPendingIntent("delete"), false)
  assert.equal(isPendingIntent("__proto__"), false)
  assert.equal(isPendingIntent(null), false)
})

test("намерение добавляется к адресу", () => {
  assert.equal(returnUrlWithIntent("/listings/vehicle/abc", "phone"), `/listings/vehicle/abc?${INTENT_PARAM}=phone`)
})

test("намерение не ломает адрес с параметрами", () => {
  const url = returnUrlWithIntent("/listings/vehicle/abc?from=telegram", "phone")
  assert.match(url, /from=telegram/)
  assert.match(url, new RegExp(`${INTENT_PARAM}=phone`))
  assert.equal(url.split("?").length, 2, "получилось два знака вопроса")
})

test("намерение читается из адреса", () => {
  assert.equal(readIntent(`?${INTENT_PARAM}=phone`), "phone")
  assert.equal(readIntent(`?${INTENT_PARAM}=favorite&x=1`), "favorite")
})

test("чужое намерение отбрасывается молча", () => {
  /* Человек мог поправить адрес руками, и падать из-за этого незачем. */
  assert.equal(readIntent(`?${INTENT_PARAM}=drop-database`), null)
  assert.equal(readIntent("?x=1"), null)
  assert.equal(readIntent(""), null)
})

test("намерение убирается из адреса", () => {
  /* Без очистки обновление страницы открывало бы телефон снова, а «Назад»
     вёл бы по кругу. */
  assert.equal(stripIntent(`/listings/vehicle/abc?${INTENT_PARAM}=phone`), "/listings/vehicle/abc")
  assert.equal(
    stripIntent(`/listings/vehicle/abc?from=telegram&${INTENT_PARAM}=phone`),
    "/listings/vehicle/abc?from=telegram",
  )
  // Адрес без намерения не портится.
  assert.equal(stripIntent("/listings/vehicle/abc"), "/listings/vehicle/abc")
})

// === Применение на странице ===

const page = read("../src/app/listings/vehicle/[id]/VehicleDetailClient.tsx")

test("вход уносит намерение с собой", () => {
  assert.match(page, /returnUrlWithIntent\(`\/listings\/vehicle\/\$\{data\.id\}`, "phone"\)/)
  assert.match(page, /returnUrlWithIntent\(`\/listings\/vehicle\/\$\{data\.id\}`, "favorite"\)/)
})

test("намерение выполняется один раз", () => {
  /* Иначе обновление страницы открывало бы телефон снова. */
  assert.match(page, /intentDone\.current = true/)
  assert.match(page, /history\.replaceState\(null, "", stripIntent/)
})

test("возврат всегда на ту же страницу", () => {
  // Уводить человека после входа в другое место — верный способ его потерять.
  const rules = read("../src/lib/pending-intent.ts")
  assert.doesNotMatch(rules, /https?:\/\//, "в правилах не должно быть внешних адресов")
})
