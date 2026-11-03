// Server-only: exercise the actual worker with in-memory DB and Telegram doubles.
import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import ts from "typescript"

const encode = (source) => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
const compile = (path) => ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const scheduleUrl = encode(compile("../src/lib/signup-nudge-schedule.ts"))
const weeklyUrl = encode(compile("../src/lib/telegram-weekly-digest-message.ts"))
const telegramSource = readFileSync(new URL("../src/lib/telegram.ts", import.meta.url), "utf8")
const completion = ts.transpileModule(
  telegramSource.slice(telegramSource.indexOf("export function isInternalTelegramEmail"), telegramSource.indexOf("export function verifyTelegramInitData")),
  { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } },
).outputText
const { getTelegramRegistrationStep } = await import(encode(completion))
const DAY = 86400000
const now = new Date("2026-11-03T12:00:00Z")
const ago = (days) => new Date(+now - days * DAY)
const complete = { accountStatus: "ACTIVE", phone: "+70000000000", telegramVerifiedAt: ago(30), email: "test@example.test", emailVerified: ago(30), hashedPassword: "$2b$12$test" }

async function fixture({ contact: extra = {}, user = null, failure = null, onClaim, waveActive = () => false } = {}) {
  const state = { telegramId: "101", firstName: "<Test>", startedAt: ago(365), lastBroadcastAt: null, lastWeeklyAt: null, blocked: false, weeklyOptOut: false, registered: false, ...extra }
  const sends = []
  let writes = 0
  const matches = (row, where) => Object.entries(where).every(([key, value]) => {
    if (key === "AND") return value.every((condition) => matches(row, condition))
    if (key === "OR") return value.some((condition) => matches(row, condition))
    if (value && typeof value === "object" && "lte" in value) return row[key] !== null && +row[key] <= +value.lte
    return row[key] instanceof Date && value instanceof Date ? +row[key] === +value : row[key] === value
  })
  const key = `campaignFixture${Math.random()}`
  globalThis[key] = {
    prisma: {
      telegramContact: {
        findMany: async ({ where }) => matches(state, where) ? [{ ...state }] : [],
        updateMany: async ({ where, data }) => {
          if (!matches(state, where)) return { count: 0 }
          Object.assign(state, data); writes++
          if (onClaim && data.lastBroadcastAt) onClaim(state)
          return { count: 1 }
        },
      },
      user: { findUnique: async () => user },
    },
    getTelegramBotUsername: () => "lewheelbot",
    getTelegramMiniAppUrl: () => "https://lewheel.ru/telegram",
    getTelegramRegistrationStep,
    isTelegramCampaignWaveActive: waveActive,
    markTelegramContactBlocked: async () => { state.blocked = true },
    buildWeeklyDigestFor: async () => ({ text: "Seller invitation", reply_markup: { inline_keyboard: [] } }),
    sendTelegramCampaignPhoto: async (...args) => { sends.push(args); if (failure) throw new Error(failure) },
  }
  const shim = encode(`export const {prisma,getTelegramBotUsername,getTelegramMiniAppUrl,getTelegramRegistrationStep,markTelegramContactBlocked,buildWeeklyDigestFor,sendTelegramCampaignPhoto,isTelegramCampaignWaveActive}=globalThis[${JSON.stringify(key)}]`)
  const worker = compile("../src/lib/telegram-lifecycle-campaign.ts").replace(/from "(@\/lib\/[^"]+)"/g, (_match, name) => `from ${JSON.stringify(name.endsWith("signup-nudge-schedule") ? scheduleUrl : name.endsWith("telegram-weekly-digest-message") ? weeklyUrl : shim)}`)
  const { processTelegramLifecycle: run } = await import(encode(worker))
  return { state, sends, run: (options = {}) => run({ now, ...options }), writes: () => writes, dispose: () => { delete globalThis[key] } }
}

test("weekly lifecycle policy and durable claims", async (t) => {
  await t.test("an active live wave pauses regular workers without writes", async () => {
    const f = await fixture({ waveActive: () => true })
    try { assert.equal((await f.run()).pausedForWave, true); assert.equal(f.writes(), 0); assert.equal(f.sends.length, 0) } finally { f.dispose() }
  })
  await t.test("wave starting after claim releases unsent attempt", async () => {
    let active = false
    const f = await fixture({ waveActive: () => active, onClaim: () => { active = true } })
    try { assert.equal((await f.run()).sent, 0); assert.equal(f.state.lastBroadcastAt, null); assert.equal(f.sends.length, 0) } finally { f.dispose() }
  })
  await t.test("year-old incomplete contact receives photo, escaped text and resume/mini-app/opt-out buttons", async () => {
    const f = await fixture()
    try {
      assert.equal((await f.run()).registration, 1)
      assert.equal(f.sends[0][1], "registration")
      assert.equal(+f.state.lastWeeklyAt, +now, "registration sends count in weekly delivery stats")
      assert.ok(f.sends[0][2].length < 1024)
      const buttons = f.sends[0][3].inline_keyboard.flat()
      assert.ok(buttons.some((b) => b.url === "https://t.me/lewheelbot?start=register"))
      assert.ok(buttons.some((b) => b.web_app))
      assert.ok(buttons.some((b) => b.callback_data === "digest_off"))
      assert.equal((await f.run()).sent, 0)
    } finally { f.dispose() }
  })
  await t.test("two independent workers scanning the same contact send once", async () => {
    const f = await fixture()
    try {
      const results = await Promise.all([f.run(), f.run()])
      assert.equal(results.reduce((n, r) => n + r.sent, 0), 1)
      assert.equal(f.sends.length, 1)
    } finally { f.dispose() }
  })
  for (const contact of [{ blocked: true }, { weeklyOptOut: true }, { startedAt: ago(6) }, { lastBroadcastAt: ago(6) }, { lastWeeklyAt: ago(6) }]) {
    await t.test(`does not send to ${JSON.stringify(contact)}`, async () => {
      const f = await fixture({ contact })
      try { assert.equal((await f.run()).sent, 0); assert.equal(f.writes(), 0) } finally { f.dispose() }
    })
  }
  await t.test("registration completed despite stale contact flag gets seller campaign", async () => {
    const f = await fixture({ user: complete })
    try { assert.equal((await f.run()).seller, 1); assert.equal(f.sends[0][1], "seller"); assert.equal(f.state.registered, true) } finally { f.dispose() }
  })
  await t.test("stale registered flag cannot bypass incomplete account checks", async () => {
    const f = await fixture({ user: { ...complete, hashedPassword: null }, contact: { registered: true } })
    try { assert.equal((await f.run()).registration, 1); assert.equal(f.state.registered, false) } finally { f.dispose() }
  })
  await t.test("old daily reminder timestamp delays first weekly send", async () => {
    const f = await fixture({ user: { ...complete, regReminderAt: ago(1) } })
    try { assert.equal((await f.run()).sent, 0); assert.equal(+f.state.lastBroadcastAt, +ago(1)) } finally { f.dispose() }
  })
  await t.test("opt-out arriving after claim suppresses delivery", async () => {
    const f = await fixture({ onClaim: (state) => { state.weeklyOptOut = true } })
    try { assert.equal((await f.run()).sent, 0); assert.equal(f.sends.length, 0) } finally { f.dispose() }
  })
  await t.test("suspended account never receives a marketing campaign", async () => {
    const f = await fixture({ user: { ...complete, accountStatus: "SUSPENDED" } })
    try { assert.equal((await f.run()).sent, 0); assert.equal(f.sends.length, 0) } finally { f.dispose() }
  })
  await t.test("blocked Telegram response retires contact", async () => {
    const f = await fixture({ failure: "Forbidden: bot was blocked by the user" })
    try { assert.equal((await f.run()).blocked, 1); assert.equal(f.state.blocked, true) } finally { f.dispose() }
  })
  await t.test("explicit flood rejection releases claim and stops for the next scheduled run", async () => {
    const f = await fixture({ failure: "Too Many Requests: retry after 60" })
    try {
      const result = await f.run()
      assert.equal(result.sent, 0)
      assert.equal(result.retryAfterSeconds, 60)
      assert.equal(f.state.lastBroadcastAt, null)
      assert.equal(f.state.lastWeeklyAt, null)
    } finally { f.dispose() }
  })
  await t.test("uncertain network failure keeps weekly claim to prevent duplicate photos", async () => {
    const f = await fixture({ failure: "socket hang up" })
    const errors = t.mock.method(console, "error", () => {})
    try {
      assert.equal((await f.run()).failed, 1)
      assert.equal((await f.run()).sent, 0)
      assert.equal(f.sends.length, 1)
      assert.equal(+f.state.lastBroadcastAt, +now)
    } finally { errors.mock.restore(); f.dispose() }
  })
  await t.test("dry run neither mutates contacts nor sends", async () => {
    const f = await fixture()
    try { assert.equal((await f.run({ dryRun: true })).due, 1); assert.equal(f.writes(), 0); assert.equal(f.sends.length, 0) } finally { f.dispose() }
  })
})
