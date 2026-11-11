import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import ts from "typescript"

const source = ts.transpileModule(readFileSync(new URL("../src/lib/chat-network-stats.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText.replace(/^import .*from "@\/lib\/[^"]+";$/gm, "")

async function fixture(counts) {
  const key = `audience${Math.random()}`
  let requests = 0
  globalThis[key] = {
    prisma: { telegramChat: { findMany: async () => counts.map((_, id) => ({ id })) } },
    telegramApi: async (_, { chat_id }) => {
      requests++
      const count = counts[chat_id]
      if (count == null) throw new Error("Telegram unavailable")
      return count
    },
  }
  const prefix = `const { prisma, telegramApi } = globalThis[${JSON.stringify(key)}];\n`
  const { getChatNetworkStats } = await import(`data:text/javascript;base64,${Buffer.from(prefix + source).toString("base64")}`)
  return { getChatNetworkStats, requests: () => requests, dispose: () => { delete globalThis[key] } }
}

test("concurrent posts reuse one complete measurement and its timestamp", async () => {
  const f = await fixture([30, 42, 16])
  try {
    const [first, second] = await Promise.all([f.getChatNetworkStats(), f.getChatNetworkStats()])
    assert.equal(first.members, 88)
    assert.ok(first.checkedAt instanceof Date)
    assert.equal(first, second)
    assert.equal(await f.getChatNetworkStats(), first)
    assert.equal(f.requests(), 3)
  } finally { f.dispose() }
})

test("partial measurement omits the network total and timestamp", async () => {
  const f = await fixture([30, null, 16])
  try {
    const snapshot = await f.getChatNetworkStats()
    assert.equal(snapshot.chats, 3)
    assert.equal(snapshot.members, null)
    assert.equal(snapshot.checkedAt, null)
  } finally { f.dispose() }
})
