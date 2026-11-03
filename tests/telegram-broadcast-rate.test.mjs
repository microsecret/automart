// Server only. Simulate immediate provider replies and verify actual send starts.
import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import ts from "typescript"

const encode = (code) => `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`
const compile = (relative) => ts.transpileModule(readFileSync(new URL(relative, import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText

test("manual broadcasts start no more than five sends in any second, including blocked recipients", async () => {
  let time = 0, history
  const starts = [], blocked = []
  const key = `broadcastRate${Math.random()}`
  class Clock extends Date { constructor(...args) { super(...(args.length ? args : [time])) } static now() { return time } }
  globalThis[key] = {
    Clock,
    timeout: (callback, milliseconds) => { time += milliseconds; callback(); return 0 },
    prisma: {
      telegramContact: {
        findMany: async () => Array.from({ length: 12 }, (_, index) => ({ telegramId: `audit-${index}` })),
        updateMany: async () => ({ count: 1 }),
      },
      telegramBroadcast: { create: async ({ data }) => { history = data } },
    },
    telegramApi: async () => {
      starts.push(time)
      if (starts.length === 3 || starts.length === 9) throw new Error("Forbidden: bot was blocked by the user")
    },
    markTelegramContactBlocked: async (id) => { blocked.push(id) },
  }
  const shim = encode(`export const {prisma,telegramApi,markTelegramContactBlocked}=globalThis[${JSON.stringify(key)}]`)
  const audience = encode(compile("../src/lib/telegram-broadcast-audience.ts"))
  const source = compile("../src/lib/telegram-broadcast.ts").replace(/from "(@\/lib\/[^"]+)"/g,
    (_match, name) => `from ${JSON.stringify(name.endsWith("telegram-broadcast-audience") ? audience : shim)}`)
  try {
    const { sendTelegramBroadcast } = await import(encode(`const Date=globalThis[${JSON.stringify(key)}].Clock;const setTimeout=globalThis[${JSON.stringify(key)}].timeout;\n${source}`))
    const result = await sendTelegramBroadcast({ text: "Audit only", audience: "all" })
    assert.equal(starts.length, 12)
    for (let index = 5; index < starts.length; index++) assert.ok(starts[index] - starts[index - 5] >= 1000, "six starts cannot fit inside one second")
    assert.equal(result.delivered, 10)
    assert.equal(result.blocked, 2)
    assert.equal(blocked.length, 2)
    assert.equal(history.total, 12)
    assert.equal(history.delivered, 10)
  } finally { delete globalThis[key] }
})
