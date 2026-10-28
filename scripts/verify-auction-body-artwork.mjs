// Isolated database and browser; no production data or accounts are modified.
import assert from "node:assert/strict"
import { access, mkdir, readdir, stat, writeFile } from "node:fs/promises"
import { chromium } from "playwright-core"
import { PrismaClient } from "@prisma/client"
const base = process.env.AUDIT_BASE_URL || "http://127.0.0.1:4011"
assert.match(base, /^http:\/\/127\.0\.0\.1:\d+$/)
assert.ok((process.env.DATABASE_URL || "").includes("audit"))
const output = "/tmp/lewheel-auction-body-20261028"
await mkdir(output, { recursive: true })
const types = ["SEDAN", "HATCHBACK", "SUV", "WAGON", "COUPE", "PICKUP", "MINIVAN"]
const db = new PrismaClient()
const results = []
const check = (name, condition) => { assert.ok(condition, name); results.push(name); console.log("PASS " + name) }
let browser
try {
  for (const [index, bodyType] of types.entries()) for (let n = 0; n <= index; n++) {
    await db.auctionListing.create({ data: {
      sourceId: `body-${bodyType}-${n}`, source: "ENCAR", sourceUrl: "https://www.encar.com/",
      make: "Audit", model: `${bodyType} — проверка оформления`, year: new Date().getFullYear(), bodyType,
      mileage: 15000, sourcePrice: 10000000, sourceCurrency: "KRW", priceRub: 600000,
      markup: 10000, finalPrice: 610000, country: "KR", status: "ACTIVE", isTranslated: true,
      sourceLastSeenAt: new Date(), lastChecked: new Date(),
    } })
  }
  const distribution = await (await fetch(base + "/api/auctions?view=card")).json()
  check("API exposes all seven seeded body types", distribution.analytics.bodyDistribution.length === 7)
  for (const [index, bodyType] of types.entries()) check(`${bodyType}: real count retained`, distribution.analytics.bodyDistribution.find(item => item.bodyType === bodyType)?.count === index + 1)
  const omitted = types.find(type => !distribution.analytics.bodyDistribution.slice(0, 6).some(item => item.bodyType === type))
  let bytes = 0
  for (const type of types) for (const width of [120, 240]) {
    const size = (await stat(`public/images/ui/body-v1/${type.toLowerCase()}-${width}.webp`)).size
    check(`${type}-${width}: bounded image weight`, size > 0 && size < 30000)
    bytes += size
  }
  let executablePath = chromium.executablePath()
  try { await access(executablePath) } catch {
    for (const folder of (await readdir("/root/.cache/ms-playwright")).filter(name => /^chromium-\d+$/.test(name)).sort().reverse()) {
      const candidate = `/root/.cache/ms-playwright/${folder}/chrome-linux64/chrome`
      try { await access(candidate); executablePath = candidate; break } catch { /* next browser */ }
    }
  }
  browser = await chromium.launch({ executablePath, args: ["--no-sandbox", "--disable-dev-shm-usage"] })
  for (const width of [390, 820, 1560]) for (const theme of ["light", "dark"]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, deviceScaleFactor: width === 390 ? 2 : 1, reducedMotion: "reduce" })
    await context.addInitScript(value => { localStorage.setItem("automart-color-scheme", value); localStorage.setItem("lw-quick-tour-v1", "done") }, theme)
    await context.route("**/*", route => new URL(route.request().url()).origin === base ? route.continue() : route.abort())
    const page = await context.newPage()
    for (const filter of ["", omitted]) {
      const name = `${width}-${theme}-${filter || "top-six"}`
      check(name + ": HTTP 200", (await page.goto(base + "/auctions" + (filter ? `?bodyType=${filter}` : ""), { waitUntil: "networkidle" })).status() === 200)
      await page.locator(".auction-body-tile").first().waitFor()
      check(name + ": expected tile count", await page.locator(".auction-body-tile").count() === (filter ? 1 : 6))
      for (const tile of await page.locator(".auction-body-tile").all()) {
        const type = await tile.getAttribute("data-body-type")
        const image = tile.locator("img")
        await image.evaluate(async img => { img.loading = "eager"; await img.decode() })
        check(`${name} ${type}: distinct asset selected`, (await image.evaluate(img => img.currentSrc)).endsWith(`/${type.toLowerCase()}-${width === 390 ? 240 : 120}.webp`))
        check(`${name} ${type}: contained and decorative`, await image.evaluate(img => {
          const a = img.getBoundingClientRect(), b = img.closest("button").getBoundingClientRect()
          return img.alt === "" && img.naturalWidth > 0 && getComputedStyle(img).objectFit === "contain" && a.left >= b.left && a.right <= b.right && a.bottom <= b.bottom
        }))
        check(`${name} ${type}: compact tile`, await tile.evaluate(el => el.getBoundingClientRect().height <= 140))
        check(`${name} ${type}: actual count visible`, (await tile.locator(".auction-body-tile__count").innerText()) === String(types.indexOf(type) + 1))
      }
      check(name + ": no page overflow", await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
      if (width === 390 && !filter) {
        await page.locator(".auction-body-tiles").evaluate(el => el.scrollLeft = el.scrollWidth)
        check(name + ": horizontal rail reaches last tile", await page.locator(".auction-body-tile").last().evaluate(el => { const a = el.getBoundingClientRect(), b = el.parentElement.getBoundingClientRect(); return a.right <= b.right + 1 }))
        await page.locator(".auction-body-tiles").evaluate(el => el.scrollLeft = 0)
      }
      await page.screenshot({ path: `${output}/${name}.png`, fullPage: false })
    }
    await page.goto(base + "/auctions", { waitUntil: "networkidle" })
    const button = page.locator(".auction-body-tile").first()
    const body = await button.getAttribute("data-body-type")
    await button.focus()
    await page.keyboard.press("Enter")
    await page.waitForURL(url => url.searchParams.get("bodyType") === body)
    check(`${width}-${theme}: keyboard selection works`, await page.locator(`[data-body-type="${body}"]`).getAttribute("aria-pressed") === "true")
    await page.locator(`[data-body-type="${body}"]`).click()
    await page.waitForURL(url => !url.searchParams.has("bodyType"))
    check(`${width}-${theme}: click clears selection`, !(new URL(page.url())).searchParams.has("bodyType"))
    await context.close()
  }
  await writeFile(`${output}/report.json`, JSON.stringify({ checks: results.length, optimizedBytes: bytes, results }, null, 2))
  console.log(`AUCTION_BODY_VERIFIED: ${results.length} checks, ${bytes} bytes for all 14 variants`)
} finally { await browser?.close(); await db.$disconnect() }
