// Browser verification against a disposable audit database, never production.
import assert from "node:assert/strict"
import { access, mkdir, readdir, writeFile } from "node:fs/promises"
import { PrismaClient } from "@prisma/client"
import { encode } from "next-auth/jwt"
import { chromium } from "playwright-core"

const base = process.env.AUDIT_BASE_URL || "http://127.0.0.1:4011"
assert.match(base, /^http:\/\/127\.0\.0\.1:\d+$/)
assert.ok((process.env.DATABASE_URL || "").includes("audit"))
assert.ok(process.env.NEXTAUTH_SECRET)
const output = "/tmp/lewheel-section-hubs-20261027"
await mkdir(output, { recursive: true })
const db = new PrismaClient()
const results = []
let browser
function check(name, condition) { assert.ok(condition, name); results.push(name); console.log("PASS " + name) }
try {
  const user = await db.user.create({ data: { name: "Проверка разделов", email: `hubs-${Date.now()}@audit.invalid` } })
  await db.forumSection.upsert({ where: { slug: "audit-hubs" }, create: { slug: "audit-hubs", title: "Проверка оформления раздела", groupKey: "TOPIC" }, update: {} })
  const token = await encode({ secret: process.env.NEXTAUTH_SECRET, maxAge: 1800, token: { id: user.id, sub: user.id, role: user.role } })
  let executablePath = chromium.executablePath()
  try { await access(executablePath) } catch {
    for (const folder of (await readdir("/root/.cache/ms-playwright")).filter(name => /^chromium-\d+$/.test(name)).sort().reverse()) {
      const candidate = `/root/.cache/ms-playwright/${folder}/chrome-linux64/chrome`
      try { await access(candidate); executablePath = candidate; break } catch { /* next browser */ }
    }
  }
  browser = await chromium.launch({ executablePath, args: ["--no-sandbox", "--disable-dev-shm-usage"] })
  const routes = [
    ["parts", "/parts-finder"], ["auctions", "/auctions"], ["forum", "/forum"],
    ["forum-section", "/forum/audit-hubs"], ["documents", "/services/legal-documents"],
    ["valuation", "/services/valuation"], ["help", "/help"],
  ]
  for (const mobile of [false, true]) for (const theme of ["light", "dark"]) {
    const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1560, height: 1000 }, reducedMotion: "reduce" })
    await context.addCookies([{ name: "next-auth.session-token", value: token, url: base }])
    await context.addInitScript(value => { localStorage.setItem("automart-color-scheme", value); localStorage.setItem("lw-quick-tour-v1", "done") }, theme)
    await context.route("**/*", route => new URL(route.request().url()).origin === base ? route.continue() : route.abort())
    // Fixtures test presentation and submitted payload without using another person's data.
    await context.route("**/api/vehicles", route => route.fulfill({ json: { vehicles: [{ id: "audit-vehicle", make: "Audit", model: "Sedan", year: 2022, price: 1200000, mileage: 40000, condition: "USED", location: "Москва" }] } }))
    let submittedVehicle
    await context.route("**/api/ai/valuation", async route => {
      submittedVehicle = route.request().postDataJSON()?.vehicleId
      await route.fulfill({ json: { estimatedValue: 1000000, min: 900000, max: 1100000, disclaimer: "Тестовый ориентир", factors: { ageFactor: .9, mileageFactor: .95, stateFactor: 1 } } })
    })
    for (const [key, path] of routes) {
      const name = `${key}-${mobile ? "mobile" : "desktop"}-${theme}`
      const page = await context.newPage()
      const response = await page.goto(base + path, { waitUntil: "networkidle" })
      check(name + ": HTTP 200", response.status() === 200)
      await page.locator(`html[data-mantine-color-scheme="${theme}"]`).waitFor()
      await page.locator("[data-section-scene]").first().waitFor()
      check(name + ": one h1", await page.locator("h1").count() === 1)
      await page.locator("[data-section-scene] img").evaluateAll(async images => { await Promise.all(images.map(image => image.decode().catch(() => {}))) })
      check(name + ": scene decoded and decorative", await page.locator("[data-section-scene] img").evaluateAll(images => images.every(image => image.complete && image.naturalWidth > 0 && image.alt === "")))
      check(name + ": no page overflow", await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
      check(name + ": heading fits header", await page.locator("[data-section-scene]").first().evaluate(el => { const a = el.getBoundingClientRect(); const b = el.querySelector("h1").getBoundingClientRect(); return b.left >= a.left && b.right <= a.right && b.bottom <= a.bottom }))
      await page.screenshot({ path: `${output}/${name}.png` })
      if (key === "parts") {
        check(name + ": search button uses contrasting enamel", await page.getByRole("button", { name: "Найти", exact: true }).first().evaluate(el => getComputedStyle(el).backgroundColor === "rgb(8, 83, 95)"))
        check(name + ": compact product tiles", await page.locator(".parts-departments__group").evaluateAll(items => items.every(el => el.getBoundingClientRect().height <= 100)))
        check(name + ": ten initial illustrated groups", await page.locator(".parts-departments__group img").count() === 10)
        await page.getByRole("button", { name: "Каталоги", exact: true }).click()
        check(name + ": catalog opens", await page.locator("#shop-catalog-menu").isVisible())
        check(name + ": category artwork present", await page.locator("#shop-catalog-menu img").count() >= 8)
        if (!mobile) await page.screenshot({ path: `${output}/catalog-menu-${theme}.png` })
        await page.keyboard.press("Escape")
        check(name + ": Escape closes catalog", await page.locator("#shop-catalog-menu").count() === 0)
        await page.getByRole("button", { name: "Тормозные колодки", exact: true }).click()
        await page.waitForURL(/group=brake_pads/)
        check(name + ": group URL works", page.url().includes("group=brake_pads"))
      }
      if (key === "forum") {
        await page.getByRole("textbox", { name: "Поиск по форуму" }).fill("ремонт")
        await page.getByRole("textbox", { name: "Поиск по форуму" }).press("Enter")
        await page.waitForURL(/\/forum\/search\?q=/)
        check(name + ": keyboard search works", decodeURI(page.url()).includes("ремонт"))
      }
      if (key === "documents") {
        check(name + ": white CTA has dark ink", await page.getByRole("link", { name: "Как проходит сделка" }).evaluate(el => { const rgb = getComputedStyle(el).color.match(/\d+/g).map(Number); return rgb.slice(0, 3).every(value => value < 160) }))
        await page.getByRole("link", { name: "Заполнить шаблон", exact: true }).first().click()
        check(name + ": template anchor works", new URL(page.url()).hash === "#document-builder")
        check(name + ": real builder visible", await page.locator("#document-builder").isVisible())
      }
      if (key === "valuation") {
        await page.getByRole("button", { name: "Рассчитать ориентир" }).click()
        await page.getByText("Тестовый ориентир", { exact: true }).waitFor()
        check(name + ": selected vehicle submitted", submittedVehicle === "audit-vehicle")
        check(name + ": result visible", await page.getByText("Предварительный ориентир", { exact: true }).isVisible())
        await page.screenshot({ path: `${output}/valuation-result-${mobile ? "mobile" : "desktop"}-${theme}.png` })
      }
      if (key === "help") check(name + ": support destination preserved", await page.getByRole("link", { name: /Написать в поддержку/ }).getAttribute("href") === "/help/support")
      await page.close()
    }
    await context.close()
  }
  await writeFile(output + "/report.json", JSON.stringify({ checks: results.length, results, failures: [] }, null, 2))
  console.log(`SECTION_HUBS_VERIFIED checks=${results.length} views=28`)
} finally { await browser?.close(); await db.$disconnect() }
