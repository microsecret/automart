// Browser fixtures are explicit geometry, never production vehicle photos.
import assert from "node:assert/strict"
import { access, mkdir, readdir, writeFile } from "node:fs/promises"
import { chromium } from "playwright-core"
import { PrismaClient } from "@prisma/client"
const base = process.env.AUDIT_BASE_URL || "http://127.0.0.1:4011"
assert.match(base, /^http:\/\/127\.0\.0\.1:\d+$/)
assert.ok((process.env.DATABASE_URL || "").includes("audit"))
const output = "/tmp/lewheel-auction-card-media-20261028"
await mkdir(output, { recursive: true })
const db = new PrismaClient(), results = []
const check = (name, condition) => { assert.ok(condition, name); results.push(name); console.log("PASS " + name) }
let browser
try {
  const records = {}
  for (const [index, kind] of ["landscape", "portrait", "broken", "missing", "timeout"].entries()) {
    records[kind] = await db.auctionListing.create({ data: {
      sourceId: `media-${kind}`, source: "ENCAR", sourceUrl: "https://www.encar.com/",
      make: "Audit", model: `Проверка фото ${kind}`, year: new Date().getFullYear(),
      bodyType: "SEDAN", mileage: 15000, sourcePrice: 10000000, sourceCurrency: "KRW",
      priceRub: 600000, markup: 10000, finalPrice: 610000, country: "KR", status: "ACTIVE",
      isTranslated: true, sourceLastSeenAt: new Date(), lastChecked: new Date(),
      imageUrl: kind === "missing" ? null : `/uploads/audit-${kind}.svg`,
      createdAt: new Date(Date.now() - index * 1000),
    } })
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
    const name = `${width}-${theme}`
    const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: "reduce" })
    await context.addInitScript(value => { localStorage.setItem("automart-color-scheme", value); localStorage.setItem("lw-quick-tour-v1", "done") }, theme)
    await context.route("**/*", route => new URL(route.request().url()).origin === base ? route.continue() : route.abort())
    await context.route("**/uploads/audit-*.svg", async route => {
      const kind = new URL(route.request().url()).pathname.match(/audit-(.+)\.svg/)[1]
      if (kind === "broken") return route.fulfill({ status: 404, body: "Audit missing file" })
      if (kind === "timeout") { await new Promise(resolve => setTimeout(resolve, 11000)); return route.abort().catch(() => {}) }
      const w = kind === "portrait" ? 300 : 900, h = kind === "portrait" ? 900 : 400
      return route.fulfill({ contentType: "image/svg+xml", body: `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="#527b80"/><rect x="2" y="2" width="${w - 4}" height="${h - 4}" fill="none" stroke="#e4bd9f" stroke-width="4"/><text x="20" y="45" font-family="sans-serif" font-size="20" fill="white">AUDIT ${kind}</text></svg>` })
    })
    const page = await context.newPage()
    check(name + ": HTTP 200", (await page.goto(base + "/auctions", { waitUntil: "domcontentloaded" })).status() === 200)
    const card = kind => page.locator(`a[href="/auctions/${records[kind].id}"]`).filter({ has: page.locator(".auction-result-card") })
    await card("landscape").waitFor()
    const timeoutMedia = card("timeout").locator(".auction-card__media")
    // Off-screen lazy images are not requested yet; missing/error geometry
    // remains stable once each card is brought into view.
    let before
    for (const kind of ["landscape", "portrait", "broken", "missing", "timeout"]) {
      const media = card(kind).locator(".auction-card__media")
      await media.scrollIntoViewIfNeeded()
      if (kind === "timeout") before = await timeoutMedia.boundingBox()
      const expected = ["broken", "timeout"].includes(kind) ? "unavailable" : kind === "missing" ? "missing" : "loaded"
      await page.waitForFunction(({ id, state }) => document.querySelector(`a[href="/auctions/${id}"] [data-auction-media-state]`)?.getAttribute("data-auction-media-state") === state, { id: records[kind].id, state: expected }, { timeout: 15000 })
      check(`${name} ${kind}: stable 4:3 frame`, await media.evaluate(el => { const r = el.getBoundingClientRect(); return Math.abs(r.width / r.height - 4 / 3) < .015 }))
      check(`${name} ${kind}: complete price disclaimer fits`, await card(kind).locator(".auction-result-card__price-note").evaluate(el => el.textContent.includes("без пошлины и доставки") && getComputedStyle(el).whiteSpace === "normal" && el.scrollWidth <= el.clientWidth + 1 && el.scrollHeight <= el.clientHeight + 1))
      check(`${name} ${kind}: named vector country flag`, (await media.locator(".auction-card__country").innerText()).includes("Корея") && await media.locator(".auction-card__country svg").count() === 1)
      check(`${name} ${kind}: country/source badges do not overlap`, await media.evaluate(el => { const a = el.querySelector(".auction-card__source").getBoundingClientRect(), b = el.querySelector(".auction-card__country").getBoundingClientRect(); return a.right <= b.left && b.right <= el.getBoundingClientRect().right }))
      if (expected === "loaded") {
        const img = media.locator(":scope > img")
        await card(kind).hover()
        check(`${name} ${kind}: whole photo retained on hover`, await img.evaluate(el => getComputedStyle(el).objectFit === "contain" && getComputedStyle(el).transform === "none"))
        check(`${name} ${kind}: source aspect retained`, await img.evaluate((el, kind) => kind === "portrait" ? el.naturalHeight > el.naturalWidth : el.naturalWidth > el.naturalHeight, kind))
      } else {
        const label = kind === "missing" ? "Фото не добавлено" : "Фото недоступно"
        check(`${name} ${kind}: honest fallback label`, await media.getByRole("img", { name: label, exact: true }).count() === 1 && (await media.innerText()).includes(label))
        check(`${name} ${kind}: one fallback icon`, await media.locator(".vehicle-fallback svg").count() === 1)
      }
    }
    const after = await timeoutMedia.boundingBox()
    check(name + ": timeout does not resize media", Math.abs(before.height - after.height) < 1)
    check(name + ": no page overflow", await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
    await card("landscape").scrollIntoViewIfNeeded()
    await page.screenshot({ path: `${output}/${name}-loaded.png` })
    await card("broken").scrollIntoViewIfNeeded()
    await page.screenshot({ path: `${output}/${name}-unavailable.png` })
    await context.close()
  }
  await writeFile(`${output}/report.json`, JSON.stringify({ checks: results.length, results }, null, 2))
  console.log(`AUCTION_CARD_MEDIA_VERIFIED: ${results.length} checks`)
} finally { await browser?.close(); await db.$disconnect() }
