// Real policy, with a fake read-only store; no Telegram sends or production DB.
import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import ts from "typescript"
const source = readFileSync(new URL("../src/lib/fuel-chat-frequency.ts", import.meta.url), "utf8")
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
  .replace('import { prisma } from "@/lib/prisma";', 'const prisma = globalThis.__fuelFrequencyStore;')
test("fuel invitations and digests share at least a 72h cooldown", async () => {
  const saved = process.env.FUEL_INVITE_INTERVAL_HOURS
  let invite = null, digest = null
  const seen = []
  globalThis.__fuelFrequencyStore = {
    fuelInvitePost: { findFirst: async args => { seen.push(args.where); return invite } },
    fuelDigestPost: { findFirst: async args => { seen.push(args.where); return digest } },
  }
  const { hasRecentFuelChatPost } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`)
  try {
    for (const value of ["", "6", "NaN", "72", "120"]) {
      process.env.FUEL_INVITE_INTERVAL_HOURS = value
      seen.length = 0; invite = null; digest = null
      const now = new Date("2026-11-02T00:00:00Z")
      assert.equal(await hasRecentFuelChatPost("-123", now), false)
      assert.equal(seen.length, 2)
      assert.ok(seen.every(where => where.chatId === "-123" && +where.publishedAt.gt === +now - (value === "120" ? 120 : 72) * 3600_000))
      invite = { id: "sent-invite" }; assert.equal(await hasRecentFuelChatPost("-123", now), true)
      invite = null; digest = { id: "sent-digest" }; assert.equal(await hasRecentFuelChatPost("-123", now), true)
    }
  } finally {
    delete globalThis.__fuelFrequencyStore
    if (saved === undefined) delete process.env.FUEL_INVITE_INTERVAL_HOURS
    else process.env.FUEL_INVITE_INTERVAL_HOURS = saved
  }
})
