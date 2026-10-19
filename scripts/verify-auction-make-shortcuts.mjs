// Server-only, read-only public catalogue check. Does not create users or lots.
import assert from "node:assert/strict"
import { access, mkdir, readdir, writeFile } from "node:fs/promises"
import { chromium } from "playwright-core"

const base = "http://127.0.0.1:4001"
const output = process.argv[2] || "/tmp/lewheel-auction-makes"
await mkdir(output, { recursive: true })
let executablePath = chromium.executablePath()
try { await access(executablePath) } catch {
  for (const folder of (await readdir("/root/.cache/ms-playwright")).filter((name) => /^chromium-\d+$/.test(name)).sort().reverse()) {
    const candidate = `/root/.cache/ms-playwright/${folder}/chrome-linux64/chrome`
    try { await access(candidate); executablePath = candidate; break } catch { /* next installed version */ }
  }
}
const browser = await chromium.launch({ executablePath, headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] })
const report = []
try {
  for (const mobile of [false, true]) {
    const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 } })
    const page = await context.newPage()
    const responseReady = page.waitForResponse((response) => response.url().includes("/api/auctions?view=card") && response.ok())
    await page.goto(`${base}/auctions?country=JP`, { waitUntil: "domcontentloaded" })
    const payload = await (await responseReady).json()
    const makes = payload.analytics.popularMakes
    assert.ok(makes.length > 0 && makes.length <= 8)
    assert.equal(new Set(makes.map((item) => item.make.toLowerCase())).size, makes.length)
    const grid = page.locator('[aria-label="Быстрый выбор марки"]')
    await grid.getByRole("button").first().waitFor()
    assert.equal(await grid.getByRole("button").count(), makes.length)
    const target = makes.find((item) => item.make.toLowerCase() === "honda") || makes[0]
    const button = grid.getByRole("button").filter({ hasText: target.make }).first()
    const filteredReady = page.waitForResponse((response) => {
      const url = new URL(response.url())
      return url.pathname === "/api/auctions" && url.searchParams.get("make") === target.make && response.ok()
    })
    await button.click()
    const filtered = await (await filteredReady).json()
    assert.ok(filtered.listings.length > 0)
    assert.ok(filtered.listings.every((item) => item.make.toLowerCase().includes(target.make.toLowerCase())))
    // Legacy bookmarks with the alternate case must still highlight the button.
    await page.goto(`${base}/auctions?country=JP&make=${encodeURIComponent(target.make.toUpperCase())}`, { waitUntil: "domcontentloaded" })
    await grid.locator("button[data-active='true']").waitFor()
    assert.equal(await grid.locator("button[data-active='true']").count(), 1)
    await grid.scrollIntoViewIfNeeded()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    assert.ok(overflow <= 1, `horizontal overflow: ${overflow}`)
    const name = mobile ? "mobile" : "desktop"
    await page.screenshot({ path: `${output}/${name}.png` })
    report.push({ viewport: name, makes, selected: target.make, filteredTotal: filtered.pagination.total, overflow })
    await context.close()
  }
} finally { await browser.close() }
await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2))
console.log("AUCTION_MAKE_SHORTCUTS_VERIFIED", report.map((item) => item.viewport).join(", "))
