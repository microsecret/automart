// Similar cards are checked against disposable records and geometric fixtures.
import assert from "node:assert/strict"
import { access, mkdir, readdir, writeFile } from "node:fs/promises"
import { chromium } from "playwright-core"
import { PrismaClient } from "@prisma/client"
const base = process.env.AUDIT_BASE_URL || "http://127.0.0.1:4011"
assert.match(base, /^http:\/\/127\.0\.0\.1:\d+$/)
assert.ok((process.env.DATABASE_URL || "").includes("audit"))
const output = "/tmp/lewheel-similar-auctions-20261029"
await mkdir(output, { recursive: true })
const db = new PrismaClient(), results = []
const check = (name, condition) => { assert.ok(condition, name); results.push(name); console.log("PASS " + name) }
let browser
try {
  const seed = { source: "ENCAR", sourceUrl: "https://www.encar.com/", make: "Audit", model: "Проверка похожих авто", year: new Date().getFullYear(),
    mileage: 0, sourcePrice: 10000000, sourceCurrency: "KRW", priceRub: 600000, markup: 10000, finalPrice: 610000,
    country: "KR", status: "ACTIVE", isTranslated: true, sourceLastSeenAt: new Date(), lastChecked: new Date() }
  const main = await db.auctionListing.create({ data: { ...seed, sourceId: "similar-main" } })
  const fixtures = [
    { kind: "landscape", bodyType: "WAGON", label: "Универсал" }, { kind: "portrait", bodyType: "MINIVAN", label: "Минивэн" },
    { kind: "broken", bodyType: "HATCHBACK", label: "Хэтчбек" }, { kind: "missing", bodyType: "PICKUP", label: "Пикап" },
  ]
  for (const fixture of fixtures) fixture.listing = await db.auctionListing.create({ data: { ...seed, sourceId: `similar-${fixture.kind}`, model: `Проверка ${fixture.kind}`, bodyType: fixture.bodyType, fuelType: "GAS", imageUrl: fixture.kind === "missing" ? null : `/uploads/similar-${fixture.kind}.svg` } })
  const response = await (await fetch(`${base}/api/auctions/${main.id}`)).json()
  check("API returns actual four similar records", response.similar.length === 4 && fixtures.every(fixture => response.similar.some(item => item.id === fixture.listing.id)))
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
    await context.route("**/uploads/similar-*.svg", route => {
      const kind = new URL(route.request().url()).pathname.match(/similar-(.+)\.svg/)[1]
      if (kind === "broken") return route.fulfill({ status: 404, body: "Audit missing photo" })
      const w = kind === "portrait" ? 300 : 900, h = kind === "portrait" ? 900 : 400
      return route.fulfill({ contentType: "image/svg+xml", body: `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="#527b80"/><rect x="2" y="2" width="${w - 4}" height="${h - 4}" fill="none" stroke="#e4bd9f" stroke-width="4"/><text x="20" y="45" font-family="sans-serif" font-size="20" fill="white">AUDIT ${kind}</text></svg>` })
    })
    const page = await context.newPage()
    check(name + ": HTTP 200", (await page.goto(`${base}/auctions/${main.id}`, { waitUntil: "networkidle" })).status() === 200)
    const section = page.locator("[data-similar-listings]")
    await section.waitFor()
    check(name + ": all four cards visible in DOM", await section.locator("[data-similar-id]").count() === 4)
    for (const fixture of fixtures) {
      const card = section.locator(`[data-similar-id="${fixture.listing.id}"]`), media = card.locator("[data-similar-media-state]")
      await media.scrollIntoViewIfNeeded()
      check(`${name} ${fixture.kind}: fixed frame`, Math.abs((await media.boundingBox()).height - 150) < 1)
      check(`${name} ${fixture.kind}: localized facts and real zero`, (await card.innerText()).includes(fixture.label) && (await card.innerText()).includes("Газ") && (await card.innerText()).includes("0 км"))
      check(`${name} ${fixture.kind}: real detail target`, await card.getAttribute("href") === `/auctions/${fixture.listing.id}`)
      if (["landscape", "portrait"].includes(fixture.kind)) {
        const image = media.locator("img")
        await image.evaluate(img => img.decode())
        check(`${name} ${fixture.kind}: whole actual fixture`, await image.evaluate((img, kind) => getComputedStyle(img).objectFit === "contain" && (kind === "portrait" ? img.naturalHeight > img.naturalWidth : img.naturalWidth > img.naturalHeight), fixture.kind))
      } else {
        const label = fixture.kind === "broken" ? "Фото недоступно" : "Фото не добавлено"
        await media.getByRole("img", { name: new RegExp(label) }).waitFor()
        check(`${name} ${fixture.kind}: neutral fallback replaces broken element`, await media.locator("img").count() === 0 && (await media.innerText()).includes(label))
      }
      check(`${name} ${fixture.kind}: theme surface used`, await media.evaluate((el, theme) => { const rgb = getComputedStyle(el).backgroundColor.match(/\d+/g).slice(0, 3).map(Number); return theme === "dark" ? Math.max(...rgb) < 100 : Math.min(...rgb) > 180 }, theme))
      await card.focus()
      check(`${name} ${fixture.kind}: keyboard focus visible`, await card.evaluate(el => getComputedStyle(el).outlineStyle !== "none"))
      await card.hover()
      check(`${name} ${fixture.kind}: reduced motion disables hover movement`, await card.evaluate(el => getComputedStyle(el).transform === "none"))
    }
    check(name + ": no viewport overflow", await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
    await section.screenshot({ path: `${output}/${name}.png` })
    await section.locator(`[data-similar-id="${fixtures[0].listing.id}"]`).press("Enter")
    await page.waitForURL(url => url.pathname === `/auctions/${fixtures[0].listing.id}`)
    check(name + ": Enter opens actual similar lot", new URL(page.url()).pathname.endsWith(fixtures[0].listing.id))
    await context.close()
  }
  await writeFile(`${output}/report.json`, JSON.stringify({ checks: results.length, results }, null, 2))
  console.log(`SIMILAR_AUCTIONS_VERIFIED: ${results.length} checks`)
} finally { await browser?.close(); await db.$disconnect() }
