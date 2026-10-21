// Run only on the application server. Uses installed TypeScript to load the
// real route wrapper, and Next's real request/response classes. No DB/network.
import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { pathToFileURL } from "node:url"
import ts from "typescript"

const require = createRequire(import.meta.url)
const nextUrl = pathToFileURL(require.resolve("next/server.js")).href
const { NextRequest } = await import(nextUrl)
const source = readFileSync(new URL("../src/lib/telegram-worker-route.ts", import.meta.url), "utf8")
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
  .replace('from "next/server"', `from ${JSON.stringify(nextUrl)}`)
const { createTelegramWorkerRoute } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`)

function request(secret = "test-worker-key") {
  return new NextRequest("http://localhost/api/telegram/cleanup", {
    method: "POST", headers: { "x-telegram-bot-api-secret-token": secret },
  })
}
function deferred() {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
const options = { label: "Test worker", errorMessage: "Worker failed" }

test("worker admission and recovery", async (t) => {
  const errors = t.mock.method(console, "error", () => {})
  const previous = process.env.TELEGRAM_WEBHOOK_SECRET
  process.env.TELEGRAM_WEBHOOK_SECRET = "test-worker-key"
  try {
    await t.test("concurrent duplicates get 409 without running or sharing another request's result", async () => {
      const gate = deferred()
      let calls = 0
      const route = createTelegramWorkerRoute(async () => { calls++; return gate.promise }, options)
      const first = route(request())
      const duplicates = await Promise.all(Array.from({ length: 10 }, () => route(request())))
      assert.equal(calls, 1)
      for (const response of duplicates) {
        assert.equal(response.status, 409)
        assert.equal(response.headers.get("retry-after"), "15")
        assert.equal(response.headers.get("cache-control"), "no-store")
        assert.equal((await response.json()).code, "WORKER_BUSY")
      }
      gate.resolve({ completed: 1 })
      assert.deepEqual(await (await first).json(), { completed: 1 })
      assert.equal((await route(request())).status, 200)
      assert.equal(calls, 2)
    })
    await t.test("rejection releases the guard for a later legitimate attempt", async () => {
      let calls = 0
      const route = createTelegramWorkerRoute(async () => {
        if (++calls === 1) throw new Error("expected test failure")
        return { recovered: true }
      }, options)
      assert.equal((await route(request())).status, 500)
      assert.equal((await route(request())).status, 200)
      assert.equal(calls, 2)
    })
    await t.test("authorization precedes admission even while busy", async () => {
      const gate = deferred()
      const route = createTelegramWorkerRoute(() => gate.promise, options)
      assert.equal((await route(request("invalid"))).status, 401)
      const first = route(request())
      assert.equal((await route(request("invalid"))).status, 401)
      delete process.env.TELEGRAM_WEBHOOK_SECRET
      assert.equal((await route(request())).status, 503)
      process.env.TELEGRAM_WEBHOOK_SECRET = "test-worker-key"
      gate.resolve({ ok: true })
      await first
    })
    await t.test("different worker routes remain independent", async () => {
      const gate = deferred()
      const busy = createTelegramWorkerRoute(() => gate.promise, options)
      const other = createTelegramWorkerRoute(async () => ({ other: true }), options)
      const first = busy(request())
      assert.equal((await other(request())).status, 200)
      assert.equal((await busy(request())).status, 409)
      gate.resolve({ ok: true })
      await first
    })
    await t.test("response serialization failure also releases admission", async () => {
      let calls = 0
      const route = createTelegramWorkerRoute(async () => ++calls === 1 ? { bad: 1n } : { ok: true }, options)
      assert.equal((await route(request())).status, 500)
      assert.equal((await route(request())).status, 200)
    })
    assert.equal(errors.mock.calls.length, 2, "both expected failures are logged")
  } finally {
    if (previous === undefined) delete process.env.TELEGRAM_WEBHOOK_SECRET
    else process.env.TELEGRAM_WEBHOOK_SECRET = previous
  }
})
