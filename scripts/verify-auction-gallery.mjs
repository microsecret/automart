// Isolated long-gallery audit with explicit geometric image fixtures.
import assert from "node:assert/strict"
import { access, mkdir, readdir, writeFile } from "node:fs/promises"
import { chromium } from "playwright-core"
import { PrismaClient } from "@prisma/client"
const base = process.env.AUDIT_BASE_URL || "http://127.0.0.1:4011"
assert.match(base, /^http:\/\/127\.0\.0\.1:\d+$/)
assert.ok((process.env.DATABASE_URL || "").includes("audit"))
const output = process.env.GALLERY_AUDIT_METADATA === "1" ? "/tmp/lewheel-gallery-metadata-20261028" : "/tmp/lewheel-auction-gallery-20261028"
await mkdir(output, { recursive: true })
const db = new PrismaClient(), results = []
const check = (name, condition) => { assert.ok(condition, name); results.push(name); console.log("PASS " + name) }
let browser
try {
  const images = Array.from({ length: 35 }, (_, i) => `/uploads/gallery-audit-${i + 1}.svg`)
  const listing = await db.auctionListing.create({ data: {
    sourceId: "gallery-audit", source: "ENCAR", sourceUrl: "https://www.encar.com/", lotNumber: "1234567890".repeat(6),
    make: "Audit", model: "Проверка галереи", year: new Date().getFullYear(), bodyType: "SEDAN",
    mileage: 15000, sourcePrice: 10000000, sourceCurrency: "KRW", priceRub: 600000,
    markup: 10000, finalPrice: 610000, country: "KR", status: "ACTIVE", isTranslated: true,
    sourceLastSeenAt: new Date(), lastChecked: new Date(), imageUrl: images[0], images: JSON.stringify(images),
  } })
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
    await context.route("**/uploads/gallery-audit-*.svg", route => {
      const index = Number(new URL(route.request().url()).pathname.match(/audit-(\d+)/)[1])
      if (index === 3) return route.fulfill({ status: 404, body: "Audit missing image" })
      const w = index === 2 ? 300 : 900, h = index === 2 ? 900 : 400
      return route.fulfill({ contentType: "image/svg+xml", body: `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="#527b80"/><rect x="3" y="3" width="${w - 6}" height="${h - 6}" fill="none" stroke="#e4bd9f" stroke-width="6"/><text x="20" y="45" font-family="sans-serif" font-size="20" fill="white">AUDIT ${index}</text></svg>` })
    })
    const page = await context.newPage()
    check(name + ": HTTP 200", (await page.goto(`${base}/auctions/${listing.id}`, { waitUntil: "networkidle" })).status() === 200)
    const gallery = page.getByRole("region", { name: "Фотографии лота", exact: true })
    const frame = gallery.locator("[data-gallery-frame]")
    const main = frame.locator("img:not([aria-hidden])")
    const selected = () => gallery.locator('button[aria-current="true"]')
    await frame.waitFor()
    await main.evaluate(img => img.decode())
    const metadata = gallery.locator("[data-gallery-metadata]")
    check(name + ": source and complete long lot number visible", (await metadata.innerText()).includes("Encar") && (await metadata.locator("[data-gallery-lot]").innerText()).includes("1234567890".repeat(6)))
    check(name + ": metadata stays above photo", await metadata.evaluate(el => el.getBoundingClientRect().bottom <= el.parentElement.querySelector("[data-gallery-frame]").getBoundingClientRect().top + 1))
    check(name + ": metadata is not clipped or covered", await metadata.evaluate(el => [...el.querySelectorAll("[data-gallery-lot], [data-gallery-country], [data-gallery-views]")].every(item => {
      const r = item.getBoundingClientRect(), parent = el.getBoundingClientRect()
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
      return r.left >= parent.left && r.right <= parent.right && item.scrollWidth <= item.clientWidth + 1 && (top === item || item.contains(top))
    })))
    check(name + ": country uses named vector flag", (await metadata.locator("[data-gallery-country]").innerText()) === "Корея" && await metadata.locator("[data-gallery-country] svg").count() === 1)
    check(name + ": one view has correct plural", (await metadata.locator("[data-gallery-views]").innerText()) === "1 просмотр")
    check(name + ": main source shown whole", await main.evaluate(img => getComputedStyle(img).objectFit === "contain" && img.naturalWidth > img.naturalHeight))
    check(name + ": previews contain images", await gallery.locator('button[aria-label^="Показать фото"] img').evaluateAll(items => items.every(img => getComputedStyle(img).objectFit === "contain")))
    check(name + ": thumbnail images stay inside buttons", await gallery.locator('button[aria-label^="Показать фото"] img').evaluateAll(items => items.every(img => { const a = img.getBoundingClientRect(), b = img.parentElement.getBoundingClientRect(); return a.left >= b.left && a.right <= b.right && a.top >= b.top && a.bottom <= b.bottom })))
    check(name + ": thirty-thumbnail window retained", await gallery.locator('button[aria-label^="Показать фото"]').count() === 30)
    await frame.focus()
    check(name + ": keyboard focus visible", await frame.evaluate(el => getComputedStyle(el).outlineStyle !== "none"))
    const initialScroll = await page.evaluate(() => scrollY)
    await page.keyboard.press("End")
    await gallery.getByText("Фото 35 из 35 · показаны ближайшие миниатюры", { exact: true }).waitFor()
    check(name + ": End selects final image", await selected().getAttribute("aria-label") === "Показать фото 35")
    check(name + ": selected thumbnail visible in rail", await selected().evaluate(el => { const a = el.getBoundingClientRect(), b = el.parentElement.getBoundingClientRect(); return a.left >= b.left - 1 && a.right <= b.right + 1 }))
    check(name + ": selection preserves page scroll", Math.abs((await page.evaluate(() => scrollY)) - initialScroll) < 2)
    await page.keyboard.press("Home")
    check(name + ": Home returns to first", await selected().getAttribute("aria-label") === "Показать фото 1")
    await page.keyboard.press("ArrowLeft")
    check(name + ": left arrow wraps", await selected().getAttribute("aria-label") === "Показать фото 35")
    await page.keyboard.press("ArrowRight")
    check(name + ": right arrow wraps", await selected().getAttribute("aria-label") === "Показать фото 1")
    await gallery.getByRole("button", { name: "Следующее фото", exact: true }).click()
    await main.evaluate(img => img.decode())
    check(name + ": portrait shown whole", await main.evaluate(img => img.naturalHeight > img.naturalWidth && getComputedStyle(img).objectFit === "contain"))
    await page.screenshot({ path: `${output}/${name}-portrait.png` })
    await gallery.getByRole("button", { name: "Показать фото 3", exact: true }).click()
    await gallery.getByText("Фото временно недоступны", { exact: true }).waitFor()
    await gallery.getByRole("button", { name: "Показать фото 3", exact: true }).locator("svg").waitFor()
    check(name + ": broken thumbnail has neutral fallback", await gallery.getByRole("button", { name: "Показать фото 3", exact: true }).locator("img").count() === 0)
    check(name + ": failed photo has recovery link", await gallery.getByRole("link", { name: "Проверить фото у источника", exact: true }).getAttribute("href") === "https://www.encar.com/")
    check(name + ": no page overflow on failure", await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
    await page.screenshot({ path: `${output}/${name}-unavailable.png` })
    await gallery.getByRole("button", { name: "Следующее фото", exact: true }).click()
    await main.evaluate(img => img.decode())
    check(name + ": next works after failed photo", await selected().getAttribute("aria-label") === "Показать фото 4" && await main.evaluate(img => img.naturalWidth > 0))
    await context.close()
  }
  await writeFile(`${output}/report.json`, JSON.stringify({ checks: results.length, results }, null, 2))
  console.log(`AUCTION_GALLERY_VERIFIED: ${results.length} checks`)
} finally { await browser?.close(); await db.$disconnect() }
