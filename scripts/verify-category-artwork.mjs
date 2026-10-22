// Server-only UI checks with deterministic intercepted catalog responses.
import assert from "node:assert/strict"
import { access, mkdir, readdir, stat, writeFile } from "node:fs/promises"
import sharp from "sharp"
import { chromium } from "playwright-core"

const base = process.env.AUDIT_BASE_URL || "http://127.0.0.1:4011"
assert.match(base, /^http:\/\/127\.0\.0\.1:\d+$/)
assert.ok((process.env.DATABASE_URL || "").includes("audit"))
const output = "/tmp/lewheel-category-artwork-20261022"
await mkdir(output, { recursive: true })
const checks = []
const check = (name, value) => { assert.ok(value, name); checks.push(name); console.log(`PASS ${name}`) }
for (const name of ["cars", "parts"]) for (const size of [320, 640]) {
  const file = `public/images/ui/category-v1/${name}-${size}.webp`
  const metadata = await sharp(file).metadata(), stats = await sharp(file).stats(), info = await stat(file)
  check(`${name}-${size}: bounded transparent WebP`, metadata.hasAlpha && metadata.width <= size && metadata.height <= size && stats.channels[3].min === 0 && info.size < 110000)
}
let executablePath = chromium.executablePath()
try { await access(executablePath) } catch {
  for (const folder of (await readdir("/root/.cache/ms-playwright")).filter((name) => /^chromium-\d+$/.test(name)).sort().reverse()) {
    const candidate = `/root/.cache/ms-playwright/${folder}/chrome-linux64/chrome`
    try { await access(candidate); executablePath = candidate; break } catch { /* next installed browser */ }
  }
}
const browser = await chromium.launch({ executablePath, headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] })
try {
  for (const mobile of [false, true].filter((value) => process.env.CATEGORY_AUDIT_DEVICE !== "mobile" || value)) for (const theme of ["light", "dark"]) {
    const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1560, height: 1000 }, isMobile: mobile, hasTouch: mobile, reducedMotion: "reduce" })
    await context.addInitScript((theme) => { localStorage.setItem("automart-color-scheme", theme); localStorage.setItem("lw-quick-tour-v1", "done") }, theme)
    await context.route("**/*", (route) => new URL(route.request().url()).origin === base ? route.continue() : route.abort())
    await context.route("**/api/listings?*", (route) => {
      const url = new URL(route.request().url())
      if (url.searchParams.get("limit") !== "20") return route.fallback()
      const isPart = url.searchParams.get("type") === "part"
      const listings = [1, 2, 3, 4].map((i) => ({ id: `audit-listing-${i}`, title: "Тестовое объявление", price: 500000 + i * 10000, location: "Москва", views: 0,
        ...(isPart ? { part: { id: `audit-part-${i}`, name: "Тестовая деталь", price: 5000, condition: "NEW", partType: "ENGINE", images: "[]" } }
          : { vehicle: { id: `audit-car-${i}`, make: "Toyota", model: "Corolla", year: 2024, mileage: 20000, fuelType: "GASOLINE", transmission: "AUTOMATIC", bodyType: "SEDAN", images: "[]", vehicleType: "CAR" } }) }))
      return route.fulfill({ json: { listings, pagination: { total: 4, pages: 1, limit: 20 } } })
    })
    for (const category of ["cars", "parts"]) {
      const key = `${category}-${mobile ? "mobile" : "desktop"}-${theme}`
      const page = await context.newPage(), errors = []
      page.on("pageerror", (error) => errors.push(error.message))
      const response = await page.goto(`${base}/category/${category}`, { waitUntil: "networkidle" })
      await page.locator(`html[data-mantine-color-scheme="${theme}"]`).waitFor()
      await page.locator(".lw-detail-action").first().waitFor()
      check(`${key}: loads`, response.status() === 200)
      check(`${key}: single semantic heading`, await page.locator("h1").count() === 1)
      check(`${key}: artwork loaded with correct category`, await page.locator(".catalog-heading__artwork").evaluate((image, category) => image.complete && image.naturalWidth > 0 && image.src.includes(`/${category}-320.webp`) && image.alt === "" && image.getAttribute("aria-hidden") === "true", category))
      check(`${key}: no horizontal overflow`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      check(`${key}: compact header`, await page.locator(".catalog-heading").evaluate((node) => node.getBoundingClientRect().height <= 230))
      check(`${key}: enamel detail actions and original destinations`, await page.locator(".lw-detail-action").evaluateAll((nodes) => nodes.length === 4 && nodes.every((node) => getComputedStyle(node).backgroundImage.includes("gradient") && /\/listings\/(vehicle|part)\/audit-/.test(node.getAttribute("href")))))
      await Promise.all([page.waitForRequest((request) => { const url = new URL(request.url()); return url.pathname === "/api/listings" && url.searchParams.get("sort") === "price_asc" && url.searchParams.get("limit") === "20" }), page.getByText("Дешевле", { exact: true }).click()])
      await page.waitForURL((url) => url.searchParams.get("sort") === "price_asc")
      check(`${key}: sort URL preserved`, new URL(page.url()).searchParams.get("sort") === "price_asc")
      await page.getByRole("button", { name: "Показать объявления списком", exact: true }).click()
      check(`${key}: list control works`, await page.getByRole("button", { name: "Показать объявления списком", exact: true }).getAttribute("aria-pressed") === "true")
      await page.getByRole("button", { name: "Показать объявления плиткой", exact: true }).click()
      if (mobile) {
        const toggle = page.getByRole("button", { name: "Фильтры", exact: true })
        await toggle.click()
        check(`${key}: mobile filter disclosure works`, await toggle.getAttribute("aria-expanded") === "true")
      }
      const price = page.getByRole("spinbutton", { name: "Цена до", exact: true })
      try {
        await Promise.all([page.waitForRequest((request) => { const url = new URL(request.url()); return url.pathname === "/api/listings" && url.searchParams.get("priceTo") === "900000" && url.searchParams.get("limit") === "20" }, { timeout: 10000 }), price.fill("900000")])
      } catch (error) {
        console.log("FILTER_DIAGNOSTIC", JSON.stringify({ key, url: page.url(), price: await price.inputValue({ timeout: 1000 }).catch(() => "unavailable"), errors }))
        await page.screenshot({ path: `${output}/${key}-failure.png` })
        throw error
      }
      check(`${key}: price filter and keyboard focus work`, await price.inputValue() === "900000" && await price.evaluate((node) => node === document.activeElement))
      check(`${key}: no runtime errors`, errors.length === 0)
      await page.locator("h1").click()
      await page.evaluate(() => window.scrollTo(0, 0))
      await page.screenshot({ path: `${output}/${key}.png` })
      await page.close()
    }
    await context.close()
  }
  await writeFile(`${output}/report.json`, JSON.stringify({ checks: checks.length, results: checks, failures: [] }, null, 2))
  console.log(`CATEGORY_ARTWORK_VERIFIED checks=${checks.length}`)
} finally { await browser.close() }
