// Server-only visual QA. Private API responses are browser-local fixtures,
// NOT authenticated API E2E evidence. No production database writes or test users.
import assert from "node:assert/strict"
import { mkdir, readdir, access, writeFile } from "node:fs/promises"
import path from "node:path"
import { chromium } from "playwright-core"
import { encode } from "next-auth/jwt"

const base = process.argv[2] || "http://127.0.0.1:4001"
assert.match(base, /^http:\/\/127\.0\.0\.1:\d+$/)
const output = process.argv[3] || "/tmp/lewheel-scenic-review"
await mkdir(output, { recursive: true })
let executablePath = chromium.executablePath()
try { await access(executablePath) } catch {
  for (const folder of (await readdir("/root/.cache/ms-playwright")).filter((name) => /^chromium-\d+$/.test(name)).sort().reverse()) {
    const candidate = `/root/.cache/ms-playwright/${folder}/chrome-linux64/chrome`
    try { await access(candidate); executablePath = candidate; break } catch { /* next installed version */ }
  }
}
assert.ok(process.env.NEXTAUTH_SECRET, "Server environment required")
const user = { id: "scenic-visual-fixture", name: "Визуальная проверка", role: "USER", email: "visual@example.invalid" }
const token = await encode({ secret: process.env.NEXTAUTH_SECRET, maxAge: 600, token: { ...user, sub: user.id } })
const referral = { link: "https://lewheel.ru/?ref=visual-preview", code: "visual-preview", tier: { percent: 20, label: "Старт", minPaidInvitees: 0 }, nextTier: null, stats: { invitedCount: 0, paidInviteesCount: 0, accruedRub: 0, paidOutRub: 0, availableRub: 0 }, invitees: [], rewards: [], payouts: [], payoutNote: "Визуальные тестовые данные" }
const stats = { totalListings: 0, totalViews: 0, favoritesCount: 0, reviewsCount: 0, garageCount: 0, avgRating: 0, unreadMessages: 0, memberSince: null, promotionPaidCount: 0, promotionSpentRub: 0, activePromotions: 0 }
const fixtures = {
  "/api/auth/session": { user, expires: new Date(Date.now() + 600000).toISOString() },
  "/api/dashboard/stats": { stats, workflow: { drafts: 0, pendingModeration: 0, active: 0, needsAttention: 0 }, listings: [], favorites: [], promotionOrders: [] },
  "/api/referral": referral,
  "/api/garage": { vehicles: [] },
  "/api/fuel-subscriptions": { subscriptions: [] },
  "/api/saved-searches": { searches: [] },
  "/api/favorites": { favorites: [], pagination: { total: 0, pages: 1 } },
  "/api/delivery-orders": { orders: [], summary: { total: 0, active: 0, pendingPayments: 0, needsAttention: 0 } },
  "/api/delivery-organizations": { organization: null },
}
const routes = ["/", "/dashboard", "/dashboard?tab=garage", "/dashboard?tab=subscriptions", "/dashboard?tab=payments", "/favorites", "/dashboard/deliveries", "/dashboard/referral"]
const browser = await chromium.launch({ executablePath, headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] })
const report = { privateDataMode: "browser-local visual fixtures; not API E2E", captures: [], failures: [] }
try {
  for (const [index, route] of routes.entries()) {
    for (const mobile of [false, true]) {
      const name = `${index}-${mobile ? "mobile-dark" : "desktop-light"}`
      const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 }, reducedMotion: "reduce" })
      await context.addInitScript((scheme) => {
        localStorage.setItem("automart-color-scheme", scheme)
        localStorage.setItem("lw-quick-tour-v1", "done")
      }, mobile ? "dark" : "light")
      if (index > 0) {
        // Middleware chooses the Secure name from the configured HTTPS origin,
        // even on loopback. Explicit headers avoid browser prefix restrictions.
        await context.setExtraHTTPHeaders({ Cookie: `next-auth.session-token=${token}; __Secure-next-auth.session-token=${token}` })
        await context.route("**/api/**", async (request) => {
          if (request.request().method() !== "GET") return request.fulfill({ status: 200, json: { success: true } })
          const pathname = new URL(request.request().url()).pathname
          if (Object.hasOwn(fixtures, pathname)) return request.fulfill({ status: 200, json: fixtures[pathname] })
          return request.continue()
        })
      }
      const page = await context.newPage()
      const errors = []
      page.on("pageerror", (error) => errors.push(error.message))
      try {
        const response = await page.goto(base + route, { waitUntil: "domcontentloaded", timeout: 60000 })
        assert.equal(response.status(), 200)
        const selector = index === 0 ? ".lw-scenic-tile" : ".lw-scenic-banner"
        await page.locator(selector).first().waitFor({ state: "visible" })
        if (route.includes("tab=")) {
          const feature = page.locator(`.lw-scenic-banner img[src*="${route.split("=")[1]}"]`).first()
          await feature.waitFor()
          await feature.scrollIntoViewIfNeeded()
        }
        await page.locator(`${selector} img`).evaluateAll(async (images) => { await Promise.all(images.map((image) => image.decode())) })
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
        assert.ok(overflow <= 1, `horizontal overflow: ${overflow}`)
        if (index === 0) {
          assert.equal(await page.locator(".lw-scenic-tile").count(), 5)
          const columns = await page.locator(".home-quick").evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length)
          assert.equal(columns, mobile ? 1 : 2)
        }
        assert.deepEqual(errors, [])
        await page.screenshot({ path: path.join(output, `${name}.png`), fullPage: false })
        report.captures.push({ route, name, overflow })
        console.log(`PASS ${name} ${route}`)
      } catch (error) {
        report.failures.push({ route, name, message: error.message })
        console.error(`FAIL ${name} ${route}: ${error.message}`)
        await page.screenshot({ path: path.join(output, `${name}-failure.png`) }).catch(() => {})
      } finally { await context.close() }
    }
  }
} finally {
  await browser.close()
  await writeFile(path.join(output, "report.json"), JSON.stringify(report, null, 2))
}
if (report.failures.length) process.exitCode = 1
