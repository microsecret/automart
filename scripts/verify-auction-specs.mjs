// Isolated source-fact presentation audit, never production catalog writes.
import assert from "node:assert/strict"
import { access, mkdir, readdir, writeFile } from "node:fs/promises"
import { chromium } from "playwright-core"
import { PrismaClient } from "@prisma/client"
const base = process.env.AUDIT_BASE_URL || "http://127.0.0.1:4011"
assert.match(base, /^http:\/\/127\.0\.0\.1:\d+$/)
assert.ok((process.env.DATABASE_URL || "").includes("audit"))
const output = "/tmp/lewheel-auction-specs-20261029"
await mkdir(output, { recursive: true })
const db = new PrismaClient(), results = []
const check = (name, condition) => { assert.ok(condition, name); results.push(name); console.log("PASS " + name) }
let browser
try {
  const lotNumber = "1234567890".repeat(6)
  const listing = await db.auctionListing.create({ data: {
    sourceId: "spec-audit", source: "ENCAR", sourceUrl: "https://www.encar.com/", lotNumber,
    make: "Audit", model: "Проверка характеристик", year: new Date().getFullYear(), bodyType: "SEDAN",
    mileage: 0, sourcePrice: 10000000, sourceCurrency: "KRW", priceRub: 600000,
    markup: 10000, finalPrice: 610000, country: "KR", status: "ACTIVE", isTranslated: true,
    location: "Россия, очень длинное описание расположения автомобиля и площадки продавца для проверки переноса строк",
    sourceLastSeenAt: new Date(), lastChecked: new Date(),
  } })
  let executablePath = chromium.executablePath()
  try { await access(executablePath) } catch {
    for (const folder of (await readdir("/root/.cache/ms-playwright")).filter(name => /^chromium-\d+$/.test(name)).sort().reverse()) {
      const candidate = `/root/.cache/ms-playwright/${folder}/chrome-linux64/chrome`
      try { await access(candidate); executablePath = candidate; break } catch { /* next browser */ }
    }
  }
  browser = await chromium.launch({ executablePath, args: ["--no-sandbox", "--disable-dev-shm-usage"] })
  for (const width of [360, 390, 820, 1560]) for (const theme of ["light", "dark"]) {
    const name = `${width}-${theme}`
    const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: "reduce" })
    await context.addInitScript(value => { localStorage.setItem("automart-color-scheme", value); localStorage.setItem("lw-quick-tour-v1", "done") }, theme)
    await context.route("**/*", route => new URL(route.request().url()).origin === base ? route.continue() : route.abort())
    const page = await context.newPage()
    check(name + ": HTTP 200", (await page.goto(`${base}/auctions/${listing.id}`, { waitUntil: "networkidle" })).status() === 200)
    const panel = page.locator("[data-source-specs]")
    await panel.waitFor()
    await panel.scrollIntoViewIfNeeded()
    const rows = panel.locator("dl > div")
    check(name + ": section heading stays compact", await panel.locator("h2").evaluate(el => parseFloat(getComputedStyle(el).fontSize) <= 18))
    const row = label => rows.filter({ has: page.locator("dt").filter({ hasText: new RegExp(`^${label}$`) }) })
    check(name + ": semantic label/value pairs", await rows.count() >= 15 && await rows.evaluateAll(items => items.every(el => el.querySelectorAll(":scope > dt").length === 1 && el.querySelectorAll(":scope > dd").length === 1)))
    check(name + ": zero mileage retained", (await row("Пробег").locator("dd").innerText()).replace(/\s+/g, " ") === "0 км" && await row("Пробег").getAttribute("data-available") === "true")
    check(name + ": full long lot retained", (await row("Номер лота").locator("dd").innerText()) === lotNumber)
    check(name + ": missing power remains explicit", (await row("Мощность ДВС").locator("dd").innerText()) === "Не опубликовано источником" && await row("Мощность ДВС").getAttribute("data-available") === "false")
    check(name + ": long location retained", (await row("Местонахождение").locator("dd").innerText()) === listing.location)
    check(name + ": rows fit panel", await rows.evaluateAll(items => items.every(el => {
      const a = el.getBoundingClientRect(), b = el.closest("[data-source-specs]").getBoundingClientRect()
      return a.left >= b.left && a.right <= b.right && el.scrollWidth <= el.clientWidth + 1
    })))
    check(name + ": values fit rows without clipping", await panel.locator("dt, dd").evaluateAll(items => items.every(el => {
      const a = el.getBoundingClientRect(), b = el.parentElement.getBoundingClientRect()
      return a.left >= b.left && a.right <= b.right + 1 && a.bottom <= b.bottom + 1 && el.scrollWidth <= el.clientWidth + 1 && el.scrollHeight <= el.clientHeight + 1
    })))
    check(name + ": labels do not collide with values", await rows.evaluateAll(items => items.every(el => {
      const a = el.querySelector("dt").getBoundingClientRect(), b = el.querySelector("dd").getBoundingClientRect()
      return a.right <= b.left + 1 || a.bottom <= b.top + 1
    })))
    const artwork = panel.locator("img")
    await artwork.evaluate(img => img.decode())
    check(name + ": compact decorative illustration loads", await artwork.evaluate(img => img.naturalWidth > 0 && img.alt === "" && img.getBoundingClientRect().width <= 40))
    check(name + ": real source link preserved", await panel.getByRole("link", { name: "Открыть объявление на Encar", exact: true }).getAttribute("href") === "https://www.encar.com/")
    check(name + ": no viewport overflow", await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
    await panel.locator("h2").scrollIntoViewIfNeeded()
    await page.evaluate(() => window.scrollBy(0, -(document.querySelector(".mantine-AppShell-header")?.getBoundingClientRect().height || 68) - 20))
    await page.screenshot({ path: `${output}/${name}.png` })
    await context.close()
  }
  await writeFile(`${output}/report.json`, JSON.stringify({ checks: results.length, results }, null, 2))
  console.log(`AUCTION_SPECS_VERIFIED: ${results.length} checks`)
} finally { await browser?.close(); await db.$disconnect() }
