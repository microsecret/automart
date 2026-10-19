// Server-only bounded, read-only regression check; not a sustained load test.
import assert from "node:assert/strict"
import { writeFile } from "node:fs/promises"

const base = "http://127.0.0.1:4001"
const report = { checks: [], failures: [] }
const output = process.argv[2] || "/tmp/lewheel-auction-read-concurrency.json"

async function read(query) {
  const start = performance.now()
  const response = await fetch(`${base}/api/auctions?${query}`, { signal: AbortSignal.timeout(20000) })
  const data = await response.json()
  return { status: response.status, ms: Math.round(performance.now() - start), data }
}

try {
  const query = "view=card&country=JP&limit=1&priceFrom=123458"
  for (const phase of ["cold", "warm"]) {
    const start = performance.now()
    const results = await Promise.all(Array.from({ length: 6 }, () => read(query)))
    report.checks.push({ phase, elapsedMs: Math.round(performance.now() - start), responses: results.map(({ status, ms, data }) => ({ status, ms, total: data.pagination?.total })) })
    for (const row of results) {
      assert.equal(row.status, 200, `${phase} concurrent request failed`)
      assert.ok(row.data.analytics && row.data.pagination.total > 0)
      assert.ok(row.data.listings.every((lot) => lot.country === "JP" && lot.finalPrice >= 123458))
      assert.equal(new Set(row.data.analytics.popularMakes.map((item) => item.make.toLowerCase())).size, row.data.analytics.popularMakes.length)
    }
  }
  const [first, next, brief] = await Promise.all([
    read(query), read(`${query}&page=2`), read("view=brief&country=KR&limit=1"),
  ])
  assert.equal(first.status, 200)
  assert.equal(next.status, 200)
  assert.equal(brief.status, 200)
  assert.notEqual(first.data.listings[0]?.id, next.data.listings[0]?.id)
  assert.equal(next.data.pagination.page, 2)
  assert.equal(brief.data.analytics, null)
  assert.ok(brief.data.listings.every((lot) => lot.country === "KR"))
  assert.ok(brief.data.listings.every((lot) => !("images" in lot)))
  report.checks.push({ phase: "pagination-and-brief-isolation", passed: true })
} catch (error) {
  report.failures.push(String(error))
  process.exitCode = 1
} finally {
  await writeFile(output, JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report))
}
if (!report.failures.length) console.log("AUCTION_READ_CONCURRENCY_VERIFIED")
