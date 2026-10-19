import assert from "node:assert/strict"
import test from "node:test"
import { createAsyncReadCache } from "../src/lib/async-read-cache.mjs"

function deferred() {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

test("six concurrent reads share one calculation and retain its result", async () => {
  const cache = createAsyncReadCache({ ttlMs: 1000 })
  const gate = deferred()
  let calls = 0
  const load = () => { calls++; return gate.promise }
  const reads = Array.from({ length: 6 }, () => cache.get("JP", load))
  await Promise.resolve()
  assert.equal(calls, 1)
  gate.resolve({ total: 2825 })
  const results = await Promise.all(reads)
  assert.ok(results.every((value) => value.total === 2825))
  assert.deepEqual(await cache.get("JP", load), { total: 2825 })
  assert.equal(calls, 1)
})

test("zero TTL shares pending work but reads live values again after completion", async () => {
  const cache = createAsyncReadCache({ ttlMs: 0 })
  let calls = 0
  const load = async () => ++calls
  assert.deepEqual(await Promise.all([cache.get("page", load), cache.get("page", load)]), [1, 1])
  assert.equal(await cache.get("page", load), 2)
})

test("TTL starts on completion and expires at the exact boundary", async () => {
  let time = 0
  const cache = createAsyncReadCache({ ttlMs: 100, now: () => time })
  const gate = deferred()
  const read = cache.get("JP", () => gate.promise)
  time = 500
  gate.resolve("ready")
  await read
  time = 599
  assert.equal(await cache.get("JP", async () => "too soon"), "ready")
  time = 600
  assert.equal(await cache.get("JP", async () => "fresh"), "fresh")
})

test("failed and synchronous-throwing loaders can be retried", async () => {
  const cache = createAsyncReadCache({ ttlMs: 1000 })
  const gate = deferred()
  const first = cache.get("JP", () => gate.promise)
  const second = cache.get("JP", () => gate.promise)
  const failures = Promise.allSettled([first, second])
  gate.reject(new Error("database timeout"))
  assert.ok((await failures).every((row) => row.status === "rejected"))
  await assert.rejects(cache.get("JP", () => { throw new Error("sync") }), /sync/)
  assert.equal(await cache.get("JP", async () => "recovered"), "recovered")
})

test("completed entry eviction preserves recently used entries and distinct filters", async () => {
  const cache = createAsyncReadCache({ ttlMs: 1000, maxEntries: 2 })
  await cache.get("JP", async () => 1)
  await cache.get("KR", async () => 2)
  assert.equal(await cache.get("JP", async () => 9), 1)
  await cache.get("CN", async () => 3)
  assert.equal(await cache.get("JP", async () => 9), 1)
  assert.equal(await cache.get("KR", async () => 4), 4)
})

test("capacity pressure does not detach existing in-flight waiters", async () => {
  const cache = createAsyncReadCache({ ttlMs: 0, maxEntries: 1 })
  const gate = deferred()
  const first = cache.get("JP", () => gate.promise)
  assert.equal(await cache.get("KR", async () => "KR"), "KR")
  const shared = cache.get("JP", async () => "wrong")
  gate.resolve("JP")
  assert.deepEqual(await Promise.all([first, shared]), ["JP", "JP"])
})

test("null values are cached and invalid limits fail explicitly", async () => {
  const cache = createAsyncReadCache({ ttlMs: 1000 })
  await cache.get("empty", async () => null)
  assert.equal(await cache.get("empty", async () => "wrong"), null)
  for (const options of [{ ttlMs: -1 }, { ttlMs: NaN }, { ttlMs: 1, maxEntries: 0 }]) {
    assert.throws(() => createAsyncReadCache(options), RangeError)
  }
})
