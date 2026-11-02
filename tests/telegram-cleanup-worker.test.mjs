import { test } from "node:test"
import assert from "node:assert/strict"
import { runTelegramCleanup } from "../src/lib/telegram-cleanup-worker.mjs"

function fixture({ attempts = 0, age = 360_000, error = null, claim = true } = {}) {
  let time = 1_800_000_000_000, calls = 0
  const row = { id: "recorded-bot-message", chatId: "-123", messageId: 7, createdAt: new Date(time - age), deleteAt: new Date(time - 1), attempts, processedAt: null }
  const store = {
    async findMany({ where }) { return row.processedAt === null && row.deleteAt <= where.deleteAt.lte ? [{ ...row }] : [] },
    async updateMany({ where, data }) {
      if (!claim || Object.entries(where).some(([key, value]) => row[key] instanceof Date ? +row[key] !== +value : row[key] !== value)) return { count: 0 }
      Object.assign(row, data); return { count: 1 }
    },
  }
  const deps = { store, now: () => time, api: async (method, payload) => { calls++; assert.equal(method, "deleteMessage"); assert.deepEqual(payload, { chat_id: "-123", message_id: 7 }); if (error) throw new Error(error) } }
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
