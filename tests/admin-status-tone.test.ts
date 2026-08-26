import assert from "node:assert/strict"
import test from "node:test"
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { AUCTION_INQUIRY_STATUS, PARTNER_STATUS, PART_STORE_STATUS, PAYMENT_STATUS, SUPPORT_TICKET_STATUS, SYNC_RUN_STATUS, USER_ACCOUNT_STATUS, describeStatus, statusBadge, toneColor, toneVariant } from "../src/lib/admin-status-tone.ts"

test("новая заявка не красится в цвет аварии", () => {
  // Красным красили и «сбой парсера», и «новая заявка». Сотрудник
  // перестаёт различать, что требует вмешательства сейчас.
  assert.equal(AUCTION_INQUIRY_STATUS.NEW.tone, "pending")
  assert.notEqual(toneColor(AUCTION_INQUIRY_STATUS.NEW.tone), "red")
})

test("«в работе» выглядит одинаково в заявках и обращениях", () => {
  // Было: у заявки синий, у обращения бирюзовый — цвет успеха. Обращение
  // казалось решённым, пока им ещё занимались.
  assert.equal(
    toneColor(AUCTION_INQUIRY_STATUS.IN_PROGRESS.tone),
    toneColor(SUPPORT_TICKET_STATUS.IN_PROGRESS.tone),
  )
})

test("«в работе» не красится цветом успеха", () => {
  assert.notEqual(toneColor(SUPPORT_TICKET_STATUS.IN_PROGRESS.tone), toneColor("success"))
})

test("«приостановлен» выглядит одинаково у партнёра и магазина", () => {
  // Было: у партнёра серый (как «ничего не случилось»), у магазина
  // красный (как авария). Одно и то же решение.
  assert.equal(
    toneColor(PARTNER_STATUS.SUSPENDED.tone),
    toneColor(PART_STORE_STATUS.SUSPENDED.tone),
  )
})

test("ограничение отличается от сбоя", () => {
  // «Заблокирован» — это решение сотрудника, а не авария. Красить их
  // одинаково значит поднимать ложную тревогу на каждой блокировке.
  assert.notEqual(
    toneColor(USER_ACCOUNT_STATUS.BANNED.tone),
    toneColor(SYNC_RUN_STATUS.FAILED.tone),
  )
  assert.equal(SYNC_RUN_STATUS.FAILED.tone, "critical")
  assert.equal(USER_ACCOUNT_STATUS.BANNED.tone, "restricted")
})

test("ожидание всюду одного цвета", () => {
  // Было четыре цвета для одного смысла: оранжевый у партнёра и магазина,
  // жёлтый у платежа, красный и синий у заявок.
  const waiting = [
    PARTNER_STATUS.PENDING, PART_STORE_STATUS.PENDING,
    PAYMENT_STATUS.PENDING, SUPPORT_TICKET_STATUS.WAITING_OPERATOR,
    AUCTION_INQUIRY_STATUS.NEW,
  ]
  const colors = new Set(waiting.map((item) => toneColor(item.tone)))
  assert.equal(colors.size, 1)
})

test("частичный успех — одно состояние, а не два цвета", () => {
  // «Частично» было оранжевым, «завершено частично» жёлтым.
  assert.equal(SYNC_RUN_STATUS.PARTIAL.tone, "pending")
})

test("успех всюду одного цвета", () => {
  const done = [
    AUCTION_INQUIRY_STATUS.SOLD, PARTNER_STATUS.VERIFIED,
    PART_STORE_STATUS.ACTIVE, SYNC_RUN_STATUS.SUCCEEDED,
    PAYMENT_STATUS.PAID, USER_ACCOUNT_STATUS.ACTIVE,
  ]
  const colors = new Set(done.map((item) => toneColor(item.tone)))
  assert.equal(colors.size, 1)
})

test("завершённое без результата не путается с успехом", () => {
  assert.notEqual(
    toneColor(AUCTION_INQUIRY_STATUS.CLOSED.tone),
    toneColor(AUCTION_INQUIRY_STATUS.SOLD.tone),
  )
})

test("срочное выделяется заливкой", () => {
  // Сбой теряется среди светлых значков, если выглядит так же.
  assert.equal(toneVariant("critical"), "filled")
  assert.equal(toneVariant("pending"), "light")
  assert.equal(toneVariant("success"), "light")
})

test("значок отдаёт и цвет, и вид", () => {
  const badge = statusBadge(SYNC_RUN_STATUS.FAILED)
  assert.equal(badge.label, "Ошибка")
  assert.equal(badge.color, "red")
  assert.equal(badge.variant, "filled")
})

test("незнакомый статус не роняет страницу", () => {
  // В базе появляются новые значения раньше, чем их учтёт админка.
  const unknown = describeStatus(PARTNER_STATUS, "ARCHIVED")
  assert.equal(unknown.label, "ARCHIVED")
  assert.equal(unknown.tone, "neutral")
})

test("пустой статус тоже не роняет страницу", () => {
  assert.equal(describeStatus(PARTNER_STATUS, null).tone, "neutral")
  assert.equal(describeStatus(PARTNER_STATUS, undefined).label, "Неизвестно")
})

test("известный статус находится", () => {
  assert.equal(describeStatus(PARTNER_STATUS, "VERIFIED").label, "Проверен")
})
