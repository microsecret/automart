import { test } from "node:test"
import assert from "node:assert/strict"
import { runTelegramCleanup } from "../src/lib/telegram-cleanup-worker.mjs"

function fixture({ attempts = 0, age = 360_000, error = null, claim = true, chatId = "-123" } = {}) {
  let time = 1_800_000_000_000, calls = 0
  const row = { id: "recorded-bot-message", chatId, messageId: 7, createdAt: new Date(time - age), deleteAt: new Date(time - 1), attempts, processedAt: null }
  const store = {
    async findMany({ where }) { return row.processedAt === null && row.deleteAt <= where.deleteAt.lte ? [{ ...row }] : [] },
    async updateMany({ where, data }) {
      if (!claim || Object.entries(where).some(([key, value]) => row[key] instanceof Date ? +row[key] !== +value : row[key] !== value)) return { count: 0 }
      Object.assign(row, data); return { count: 1 }
    },
  }
  const deps = { store, now: () => time, api: async (method, payload) => { calls++; assert.equal(method, "deleteMessage"); assert.deepEqual(payload, { chat_id: chatId, message_id: 7 }); if (error) throw new Error(error) } }
  return { row, deps, calls: () => calls, advance: ms => { time += ms } }
}
test("deletes only due recorded bot message", async () => {
  const f = fixture(); f.row.deleteAt = new Date(f.deps.now() + 1)
  assert.equal((await runTelegramCleanup(f.deps)).checked, 0)
  f.advance(2); assert.equal((await runTelegramCleanup(f.deps)).deleted, 1); assert.ok(f.row.processedAt)
})
test("transient failure after fifth attempt remains retryable", async () => {
  const f = fixture({ attempts: 5, error: "Telegram API deleteMessage timed out" })
  assert.equal((await runTelegramCleanup(f.deps)).failed, 1); assert.equal(f.row.processedAt, null)
  assert.ok(+f.row.deleteAt > f.deps.now()); f.advance(16 * 60_000)
  await runTelegramCleanup(f.deps); assert.equal(f.calls(), 2)
})
test("permission failure can recover; absent message is completed", async () => {
  const f = fixture({ error: "Forbidden: bot was kicked" }); await runTelegramCleanup(f.deps); assert.equal(f.row.processedAt, null)
  const missing = fixture({ error: "Bad Request: message to delete not found" }); assert.equal((await runTelegramCleanup(missing.deps)).deleted, 1); assert.equal(missing.row.lastError, null)
})
test("lost claim never deletes and stale attempt is recovered", async () => {
  const lost = fixture({ claim: false }); await runTelegramCleanup(lost.deps); assert.equal(lost.calls(), 0)
  const stale = fixture({ attempts: 5 }); assert.equal((await runTelegramCleanup(stale.deps)).deleted, 1)
})
test("Telegram-expired messages stop without external API calls", async () => {
  const f = fixture({ age: 48 * 60 * 60_000 }); assert.equal((await runTelegramCleanup(f.deps)).expired, 1); assert.equal(f.calls(), 0)
})

test("a flood limit defers the failed row and stops later deletions through the next poll", async () => {
  const f = fixture({ error: "Too Many Requests: retry after 180" })
  const second = fixture({ chatId: "-456" })
  second.row.id = "another-message"
  const store = {
    async findMany(args) {
      const rows = [...await f.deps.store.findMany(args), ...await second.deps.store.findMany(args)]
      return rows.sort((left, right) => +left.deleteAt - +right.deleteAt)
    },
    async updateMany(args) {
      return args.where.id === f.row.id ? f.deps.store.updateMany(args) : second.deps.store.updateMany(args)
    },
  }
  const deps = {
    ...f.deps, store, cooldown: { until: 0 },
    api: (method, payload) => payload.chat_id === second.row.chatId ? second.deps.api(method, payload) : f.deps.api(method, payload),
  }
  assert.equal((await runTelegramCleanup(deps)).failed, 1)
  assert.equal(+f.row.deleteAt, f.deps.now() + 180_000)
  assert.equal(second.row.attempts, 0)
  f.advance(10_000)
  assert.equal((await runTelegramCleanup(deps)).checked, 0)
  assert.equal(f.calls(), 1)
  f.advance(170_000)
  assert.equal((await runTelegramCleanup(deps)).deleted, 1)
  assert.equal(f.calls(), 2)
  assert.equal(second.calls(), 1)
})

test("Telegram 429 without a duration pauses the cleanup worker briefly", async () => {
  const f = fixture({ error: "Telegram API 429" })
  const deps = { ...f.deps, cooldown: { until: 0 } }
  assert.equal((await runTelegramCleanup(deps)).failed, 1)
  assert.equal(deps.cooldown.until, f.deps.now() + 30_000)
})
