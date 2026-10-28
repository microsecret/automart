import assert from "node:assert/strict"
import test from "node:test"
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { buildWeeklyDigestMessage, isWeeklyDigestDue } from "../src/lib/telegram-weekly-digest-message.ts"

const DAY = 24 * 60 * 60 * 1000
const now = new Date("2026-10-01T08:00:00Z")
const ago = (days: number) => new Date(now.getTime() - days * DAY)
const base = { blocked: false, weeklyOptOut: false, startedAt: ago(30), lastWeeklyAt: null, lastBroadcastAt: null }

test("новичку письмо не раньше чем через неделю после «Старта»", () => {
  assert.equal(isWeeklyDigestDue({ ...base, startedAt: ago(2) }, now), false)
  assert.equal(isWeeklyDigestDue({ ...base, startedAt: ago(8) }, now), true)
})

test("не чаще раза в неделю", () => {
  assert.equal(isWeeklyDigestDue({ ...base, lastWeeklyAt: ago(6) }, now), false)
  assert.equal(isWeeklyDigestDue({ ...base, lastWeeklyAt: ago(7) }, now), true)
})

test("отписка и блокировка останавливают письмо", () => {
  assert.equal(isWeeklyDigestDue({ ...base, weeklyOptOut: true }, now), false)
  assert.equal(isWeeklyDigestDue({ ...base, blocked: true }, now), false)
})

test("после недавнего напоминания письмо ждёт", () => {
  assert.equal(isWeeklyDigestDue({ ...base, lastBroadcastAt: ago(1) }, now), false)
  assert.equal(isWeeklyDigestDue({ ...base, lastBroadcastAt: ago(4) }, now), true)
})

test("кнопки: карта, поделиться личной ссылкой, подача, отписка", () => {
  const message = buildWeeklyDigestMessage({
    inviteUrl: "https://lewheel.ru/services/fuel-map?ref=ABCD1234",
    hasAccount: true,
    fuelMap: { url: "https://lewheel.ru/services/fuel-map", webApp: false },
    createListing: { url: "https://lewheel.ru/listings/create/vehicle", webApp: false },
  })
  const buttons = message.reply_markup.inline_keyboard.flat()
  assert.equal(buttons.length, 4)
  const share = buttons.find((button) => button.text.includes("Рассказать другу")) as { url: string }
  assert.ok(share.url.startsWith("https://t.me/share/url?url="))
  assert.ok(decodeURIComponent(share.url).includes("ref=ABCD1234"))
  assert.ok(buttons.some((button) => "callback_data" in button && button.callback_data === "digest_off"))
  assert.ok(message.text.length < 1024)
})

test("незарегистрированному письмо не мешает напоминаниям о регистрации", () => {
  /* Письмо уходило в 08:05, напоминание в 12:20, обе с шагом в неделю:
     письмо всегда успевало первым, и напоминание не уходило никогда. */
  assert.equal(isWeeklyDigestDue({ ...base, startedAt: ago(10), registered: false }, now), false)
  assert.equal(isWeeklyDigestDue({ ...base, startedAt: ago(34), registered: false }, now), false)
  /* После пяти недель напоминания кончаются — письмо снова идёт. */
  assert.equal(isWeeklyDigestDue({ ...base, startedAt: ago(36), registered: false }, now), true)
  /* Зарегистрированным — как раньше. */
  assert.equal(isWeeklyDigestDue({ ...base, startedAt: ago(10), registered: true }, now), true)
})

test("окно напоминаний в письме совпадает с расписанием напоминаний", async () => {
  // @ts-expect-error Node's strip-types test runner requires the explicit extension.
  const schedule = await import("../src/lib/signup-nudge-schedule.ts")
  // @ts-expect-error Node's strip-types test runner requires the explicit extension.
  const { SIGNUP_NUDGE_WINDOW_MS } = await import("../src/lib/telegram-weekly-digest-message.ts")
  assert.equal(SIGNUP_NUDGE_WINDOW_MS, schedule.FIRST_NUDGE_DELAY_MS + schedule.NUDGE_INTERVAL_MS * schedule.MAX_NUDGES)
})
