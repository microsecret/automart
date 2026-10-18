// Read-only browser check. Run on the application server after deployment.
import assert from "node:assert/strict"
import { access, mkdir, readdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { chromium } from "playwright-core"

const baseUrl = process.argv[2] || "http://127.0.0.1:4001"
const output = path.resolve(process.argv[3] || "/tmp/lewheel-component-review")
await mkdir(output, { recursive: true })
let executablePath = chromium.executablePath()
try { await access(executablePath) } catch {
  const cache = "/root/.cache/ms-playwright"
  const versions = (await readdir(cache)).filter((name) => /^chromium-\d+$/.test(name)).sort().reverse()
  executablePath = ""
  for (const version of versions) {
    const candidate = path.join(cache, version, "chrome-linux64/chrome")
    try { await access(candidate); executablePath = candidate; break } catch { /* Try the next installed browser. */ }
  }
  assert.ok(executablePath, "An installed Chromium is required; this script never installs one")
}

const captures = [
  { name: "services-dark", route: "/services", scheme: "dark", width: 1440, height: 1000, target: ".lw-service-grid" },
  { name: "services-light", route: "/services", scheme: "light", width: 1440, height: 1000, target: ".lw-service-grid" },
  { name: "home-mobile-dark", route: "/", scheme: "dark", width: 390, height: 844, target: ".home-quick" },
  { name: "home-mobile-light", route: "/", scheme: "light", width: 390, height: 844, target: ".home-quick" },
  { name: "home-desktop", route: "/", scheme: "light", width: 1440, height: 1000 },
  { name: "auctions-desktop", route: "/auctions?country=KR", scheme: "dark", width: 1440, height: 1000 },
  { name: "telegram-dark", route: "/telegram", scheme: "dark", width: 390, height: 844 },
  { name: "telegram-light", route: "/telegram", scheme: "light", width: 390, height: 844 },
]

const browser = await chromium.launch({ executablePath, headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] })
const report = { captures: [], assets: 0, detailNavigation: false, errors: [] }
try {
  for (const capture of captures) {
    const context = await browser.newContext({
      viewport: { width: capture.width, height: capture.height },
      isMobile: capture.width < 600,
      hasTouch: capture.width < 600,
      reducedMotion: "reduce",
    })
    try {
      await context.addInitScript((scheme) => localStorage.setItem("automart-color-scheme", scheme), capture.scheme)
      const page = await context.newPage()
      const pageErrors = []
      page.on("pageerror", (error) => pageErrors.push(error.message))
      const response = await page.goto(new URL(capture.route, baseUrl).href, { waitUntil: "domcontentloaded", timeout: 60000 })
      assert.equal(response.status(), 200, `${capture.name}: HTTP status`)
      await page.waitForFunction((scheme) => document.documentElement.dataset.mantineColorScheme === scheme, capture.scheme)
      await page.locator(capture.target || ".lw-service-artwork, .lw-scenic-tile__image").first().waitFor({ state: "visible", timeout: 30000 })
      const images = await page.locator(".lw-service-artwork, .lw-scenic-tile__image").evaluateAll(async (elements) => {
        await Promise.all(elements.map(async (image) => { image.loading = "eager"; try { await image.decode() } catch { /* Report below. */ } }))
        return elements.map((image) => ({ src: image.getAttribute("src"), loaded: image.complete && image.naturalWidth > 0 }))
      })
      assert.ok(images.length > 0 && images.every((image) => image.loaded), `${capture.name}: artwork loaded`)
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
      assert.ok(overflow <= 1, `${capture.name}: horizontal overflow ${overflow}px`)
      if (capture.route === "/services") {
        assert.equal(await page.locator("a.lw-service-widget").count(), 6, "All six service actions remain available")
        const card = page.locator("a.lw-service-widget").first()
        await card.focus()
        assert.equal(await card.evaluate((element) => getComputedStyle(element).outlineStyle), "solid", "Keyboard focus remains visible")
      }
      if (capture.route === "/") {
        assert.equal(await page.locator(".lw-quick-widget").count(), 5, "All five home actions remain available")
        if (capture.width < 600) {
          const columns = await page.locator(".home-quick").evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length)
          assert.equal(columns, 1, "Wide scenic actions stay readable in one mobile column")
        }
      }
      if (capture.target) await page.locator(capture.target).screenshot({ path: path.join(output, `${capture.name}.png`), timeout: 30000 })
      else await page.screenshot({ path: path.join(output, `${capture.name}.png`), timeout: 30000 })
      if (capture.name === "home-desktop") {
        const detail = page.locator(".lw-detail-action").first()
        await detail.waitFor({ state: "visible", timeout: 30000 })
        const expected = await detail.getAttribute("href")
        await Promise.all([page.waitForURL((url) => url.pathname === expected, { timeout: 30000 }), detail.click()])
        assert.match(new URL(page.url()).pathname, /^\/listings\/(vehicle|part)\//)
        report.detailNavigation = true
      }
      assert.deepEqual(pageErrors, [], `${capture.name}: uncaught browser errors`)
      report.captures.push({ name: capture.name, overflow, artworkCount: images.length, status: "passed" })
      console.log(`PASS ${capture.name}: ${images.length} artwork, no overflow or browser errors`)
    } catch (error) {
      report.errors.push({ name: capture.name, error: error.message })
      console.error(`FAIL ${capture.name}: ${error.message}`)
    } finally { await context.close() }
  }
  for (const name of ["auctions", "fuel-map", "garage", "partner", "history-check", "publish-listing", "valuation", "matching", "safe-deal", "documents", "parts", "deliveries", "messages", "favorites"]) {
    for (const size of [320, 640]) {
      const response = await fetch(new URL(`/images/ui/titanium-v1/${name}-${size}.webp`, baseUrl))
      assert.equal(response.status, 200, `${name}-${size}: public asset`)
      assert.match(response.headers.get("content-type") || "", /image\/webp/)
      assert.ok((await response.arrayBuffer()).byteLength > 1000)
      report.assets++
    }
  }
} finally {
  await browser.close()
  await writeFile(path.join(output, "report.json"), JSON.stringify(report, null, 2))
}
console.log(JSON.stringify(report, null, 2))
if (report.errors.length) process.exitCode = 1
