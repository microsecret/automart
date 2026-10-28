// Isolated browser audit. No production accounts, messages or catalog writes.
import assert from "node:assert/strict"
import { access, mkdir, readdir, writeFile } from "node:fs/promises"
import { chromium } from "playwright-core"

const base = process.env.AUDIT_BASE_URL || "http://127.0.0.1:4011"
assert.match(base, /^http:\/\/127\.0\.0\.1:\d+$/)
assert.ok((process.env.DATABASE_URL || "").includes("audit"))
const output = "/tmp/lewheel-parts-footer-20261028"
await mkdir(output, { recursive: true })
const results = []
const failures = []
const check = (name, condition) => { results.push(name); if (!condition) failures.push(name); console.log((condition ? "PASS " : "FAIL ") + name) }
let executablePath = chromium.executablePath()
try { await access(executablePath) } catch {
  for (const folder of (await readdir("/root/.cache/ms-playwright")).filter(name => /^chromium-\d+$/.test(name)).sort().reverse()) {
    const candidate = `/root/.cache/ms-playwright/${folder}/chrome-linux64/chrome`
    try { await access(candidate); executablePath = candidate; break } catch { /* next browser */ }
  }
}
const browser = await chromium.launch({ executablePath, args: ["--no-sandbox", "--disable-dev-shm-usage"] })
try {
  for (const [device, viewport] of [["desktop", { width: 1560, height: 1000 }], ["tablet", { width: 820, height: 1100 }], ["mobile", { width: 390, height: 844 }]]) for (const theme of ["light", "dark"]) {
    const context = await browser.newContext({ viewport, reducedMotion: "reduce" })
    await context.addInitScript(value => { localStorage.setItem("automart-color-scheme", value); localStorage.setItem("lw-quick-tour-v1", "done") }, theme)
    await context.route("**/*", route => new URL(route.request().url()).origin === base ? route.continue() : route.abort())
    const page = await context.newPage()
    const slugs = ["kuzov", "vyhlopnaya-sistema", "rulevoe-upravlenie", "salon", "aksessuary", "rashodniki", "avtohimiya", "instrumenty"]
    for (const slug of slugs) {
      const name = `${slug}-${device}-${theme}`
      const response = await page.goto(base + "/parts-finder/" + slug, { waitUntil: "networkidle" })
      check(name + ": HTTP 200", response.status() === 200)
      check(name + ": one heading", await page.locator("h1").count() === 1)
      const heading = page.locator(".part-category__heading")
      await heading.locator("img").evaluate(img => img.decode())
      check(name + ": artwork loads", await heading.locator("img").evaluate(img => img.naturalWidth > 0 && img.alt === ""))
      check(name + ": illustration contained", await heading.locator("img").evaluate(img => {
        const a = img.getBoundingClientRect(), b = img.parentElement.getBoundingClientRect()
        return getComputedStyle(img).objectFit === "contain" && a.left >= b.left && a.right <= b.right && a.bottom <= b.bottom
      }))
      check(name + ": no viewport overflow", await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
      const target = page.locator(".part-category__cta a")
      check(name + ": real category filter retained", (await target.getAttribute("href")).startsWith("/parts-finder?partType="))
      await page.screenshot({ path: `${output}/${name}.png` })
    }
    await page.goto(base + "/parts-finder", { waitUntil: "networkidle" })
    await page.getByRole("button", { name: "Каталоги", exact: true }).click()
    const menu = page.locator("#shop-catalog-menu")
    check(`menu ${device} ${theme}: every category illustrated`, await menu.locator("img").count() === 16)
    await menu.locator("img").evaluateAll(async images => { images.forEach(img => img.loading = "eager"); await Promise.all(images.map(img => img.decode())) })
    if (device === "desktop") await page.screenshot({ path: `${output}/menu-${theme}.png` })
    await menu.getByRole("link", { name: /Рулевое управление/ }).click()
    await page.waitForURL(/partType=STEERING/)
    check(`menu ${device} ${theme}: steering navigation works`, page.url().includes("partType=STEERING"))
    await page.goto(base + "/help/sell", { waitUntil: "networkidle" })
    const footer = page.locator("footer.market-app-footer")
    await footer.scrollIntoViewIfNeeded()
    await footer.locator("img").evaluateAll(async images => { images.forEach(img => img.loading = "eager"); await Promise.all(images.map(img => img.decode())) })
    check(`footer ${device} ${theme}: both CTA cards shown`, await footer.locator(".market-app-footer__cta-card").count() === 2)
    check(`footer ${device} ${theme}: new artwork loads`, await footer.locator(".market-app-footer__cta-icon img").evaluateAll(images => images.length === 2 && images.every(img => img.naturalWidth > 0 && img.alt === "")))
    check(`footer ${device} ${theme}: readable body width`, await footer.locator(".market-app-footer__cta-body").evaluateAll(els => els.every(el => el.getBoundingClientRect().width >= 180)))
    check(`footer ${device} ${theme}: text and button stay inside cards`, await footer.locator(".market-app-footer__cta-card").evaluateAll(cards => cards.every(card => {
      const parent = card.getBoundingClientRect()
      return [...card.querySelectorAll(".market-app-footer__cta-body, .market-app-footer__btn, .market-app-footer__cta-icon")].every(el => {
        const r = el.getBoundingClientRect(); return r.left >= parent.left && r.right <= parent.right + 1 && r.bottom <= parent.bottom
      })
    })))
    check(`footer ${device} ${theme}: actions below copy`, await footer.locator(".market-app-footer__cta-card").evaluateAll(cards => cards.every(card => card.querySelector(".market-app-footer__btn").getBoundingClientRect().top >= card.querySelector(".market-app-footer__cta-body").getBoundingClientRect().bottom)))
    check(`footer ${device} ${theme}: publish destination unchanged`, await footer.getByRole("link", { name: "Подать объявление", exact: true }).getAttribute("href") === "/listings/create/vehicle")
    const bot = footer.getByRole("link", { name: "Открыть бота", exact: true })
    check(`footer ${device} ${theme}: configured Telegram URL`, /^https:\/\/t\.me\/[A-Za-z0-9_]+$/.test(await bot.getAttribute("href")) && await bot.getAttribute("target") === "_blank")
    check(`footer ${device} ${theme}: no viewport overflow`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
    await footer.screenshot({ path: `${output}/footer-${device}-${theme}.png` })
    await context.close()
  }
  await writeFile(output + "/report.json", JSON.stringify({ checks: results.length, results, failures }, null, 2))
  assert.equal(failures.length, 0, failures.join("\n"))
  console.log(`PARTS_FOOTER_VERIFIED checks=${results.length} views=54`)
} finally { await browser.close() }
